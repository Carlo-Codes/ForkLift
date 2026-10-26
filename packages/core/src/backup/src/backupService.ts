import {
  BACKUP_FORMAT, BACKUP_VERSION, backupHeaderSchema, backupSchema
} from "@forklift/db/client";
import type { BackupDocument, TransactionType } from "@forklift/db/client";
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

  return parseOrThrow(backupSchema, json);
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
    debug.error("backup didn't fit together: %O", e);

    throw new ApiError(400, "This backup is damaged and wasn't restored", "ValidationError");
  }
}
