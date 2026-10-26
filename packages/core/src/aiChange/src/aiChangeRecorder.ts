import {
  blockTable, exerciseEntryTable, exerciseTable, planTable, workoutTable
} from "@forklift/db/client";
import type {
  AiChangeRow, AiChangeTable, TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { inTransaction } from "#utils/transaction";

import { createAiChangeDb } from "./aiChangeDb";

const debug = createDebugger("aiChangeRecorder");

// Who a write is for: the lifter in the app, or their AI through AI Access.
export type Actor = "lifter" | "ai";

const TABLES = {
  plan: planTable,
  workout: workoutTable,
  block: blockTable,
  exerciseEntry: exerciseEntryTable,
  exercise: exerciseTable
} as const satisfies Record<AiChangeTable, unknown>;

// Bookkeeping columns every write moves, so not part of what changed.
const IGNORED_COLUMNS = new Set([ "createdAt", "updatedAt" ]);

type Row = Record<string, unknown> & { id: string };

// Set while an AI write is being recorded, so the writes it is built from
// (createBlock adding its Exercise Entry, say) record as part of it rather
// than on their own. Both drivers are synchronous, so nothing interleaves.
let recording = false;
// Dates become epoch ms so a row's values survive the JSON column.
const toJson = (value: unknown) => (value instanceof Date ? value.getTime() : value);

function snapshot(tx: TransactionType): Map<string, { table: AiChangeTable; row: Row }> {
  const rows = new Map<string, { table: AiChangeTable; row: Row }>();

  for (const [ table, schema ] of Object.entries(TABLES) as [AiChangeTable, (typeof TABLES)[AiChangeTable]][]) {
    for (const row of tx.select().from(schema)
      .all() as Row[]) {
      rows.set(`${table}:${row.id}`, {
        table,
        row
      });
    }
  }

  return rows;
}

// The rows that differ between two snapshots, with just the columns that did.
function diff(
  before: ReturnType<typeof snapshot>,
  after: ReturnType<typeof snapshot>
): AiChangeRow[] {
  const changed: AiChangeRow[] = [];

  for (const [ key, { table, row } ] of after) {
    const old = before.get(key)?.row;
    const was: Record<string, unknown> = {};
    const now: Record<string, unknown> = {};

    for (const [ column, value ] of Object.entries(row)) {
      if (IGNORED_COLUMNS.has(column) || column === "id") {
        continue;
      }

      if (!old || JSON.stringify(toJson(old[ column ])) !== JSON.stringify(toJson(value))) {
        was[ column ] = toJson(old?.[ column ]);
        now[ column ] = toJson(value);
      }
    }

    if (Object.keys(now).length > 0) {
      changed.push({
        table,
        id: row.id,
        before: old ? was : null,
        after: now
      });
    }
  }

  return changed;
}

// Refuses a write the AI may never make (ADR-0002).
export function refuseAi(actor: Actor, message: string): void {
  if (actor === "ai") {
    throw new ApiError(403, message, "ForbiddenError");
  }
}

// Runs a Plan or Exercise Library write in one transaction, the caller's or a
// new one. For the AI, the transaction also records it as a Change by AI: the
// summary, worded from the write's result in the same transaction, and every
// planning row it touched, which is what Undo puts back. A write that changes
// nothing records nothing.
export function write<T>(
  actor: Actor,
  tx: TransactionType | undefined,
  fn: (tx: TransactionType) => T,
  summary: (result: T, tx: TransactionType) => string
): T {
  if (actor === "lifter" || recording) {
    return inTransaction(tx, fn);
  }

  return inTransaction(tx, t => {
    const before = snapshot(t);

    recording = true;

    let result: T;

    try {
      result = fn(t);
    } finally {
      recording = false;
    }

    const rows = diff(before, snapshot(t));

    if (rows.length > 0) {
      const text = summary(result, t);

      debug.info("recording AI change: %s", text);

      createAiChangeDb({
        summary: text,
        rows
      }, t);
    }

    return result;
  });
}
