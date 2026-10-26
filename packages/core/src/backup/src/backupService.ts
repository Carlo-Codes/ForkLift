import {
  BACKUP_FORMAT, BACKUP_VERSION, backupHeaderSchema, backupSchema
} from "@forklift/db/client";
import type {
  BackupDocument, BackupTables, TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";

import { getAllRowsDb, replaceAllRowsDb } from "./backupDb";

const debug = createDebugger("backupService");

// Everything the lifter has, as one versioned JSON document to save anywhere.
export function exportBackup(tx?: TransactionType): string {
  debug.info("exporting a backup");

  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(),
    tables: getAllRowsDb(tx)
  });
}

// A file from a newer ForkLift is told apart from a broken one, so the lifter
// knows to update the app rather than give up on the backup.
function parseBackup(text: string): BackupDocument {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(400, "This file isn't a ForkLift backup", "ValidationError");
  }

  const { version } = parseOrThrow(backupHeaderSchema, json);

  if (version > BACKUP_VERSION) {
    throw new ApiError(400, "This backup is from a newer version of ForkLift. Update the app to restore it.", "ValidationError");
  }

  const backup = parseOrThrow(backupSchema, json);

  assertRulesHold(backup.tables);

  return backup;
}

// The rules core keeps as data changes hold for a backup too.
function assertRulesHold(tables: BackupTables): void {
  const live = <R extends { deletedAt: Date | null }>(rows: R[]): R[] => rows.filter(r => !r.deletedAt);

  const broken = [
    live(tables.plan).filter(p => p.isActive).length > 1 && "only one Active Plan",
    live(tables.session).filter(s => s.status === "inProgress").length > 1 && "only one Session in progress",
    live(tables.setting).length > 1 && "only one set of Settings"
  ].filter(Boolean);

  if (broken.length > 0) {
    throw new ApiError(400, `A backup can have ${broken.join(", ")}`, "ValidationError");
  }
}

// A row that breaks a foreign key or unique index fails as a SQLite constraint
// error, which drizzle wraps in a cause; anything else is a real fault, not a
// bad file. The chain is walked by shape, since a driver's errors can come from
// another realm, where instanceof Error fails.
function isConstraintError(e: unknown): boolean {
  for (let error = e; typeof error === "object" && error !== null; error = (error as { cause?: unknown }).cause) {
    const { message, code } = error as { message?: unknown; code?: unknown };

    if (/constraint failed/i.test(String(message)) || String(code).startsWith("SQLITE_CONSTRAINT")) {
      return true;
    }
  }

  return false;
}

// Replaces all data with the backup's, in one transaction: a file that's
// invalid, from a newer version or whose rows don't fit together leaves the
// data as it was.
export function importBackup(text: string, tx?: TransactionType): void {
  const { tables } = parseBackup(text);

  debug.info("importing a backup");

  try {
    inTransaction(tx, t => replaceAllRowsDb(tables, t));
  } catch (e) {
    if (!isConstraintError(e)) {
      throw e;
    }

    debug.error("backup didn't fit together: %O", e);

    throw new ApiError(400, "This backup is damaged and wasn't restored", "ValidationError");
  }
}
