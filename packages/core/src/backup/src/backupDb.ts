import {
  aiChangeTable,
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  getDb,
  loggedSetTable,
  planTable,
  sessionIncreaseTable,
  sessionTable,
  settingTable,
  workoutTable
} from "@forklift/db/client";
import type { BackupTables, TransactionType } from "@forklift/db/client";

// Parents before children, as in the backup, so inserting in this order (and
// deleting in reverse) meets every foreign key.
const TABLES = {
  setting: settingTable,
  exercise: exerciseTable,
  plan: planTable,
  workout: workoutTable,
  block: blockTable,
  exerciseEntry: exerciseEntryTable,
  session: sessionTable,
  loggedSet: loggedSetTable,
  sessionIncrease: sessionIncreaseTable,
  aiChange: aiChangeTable
} as const;

// Stays well under SQLite's limit on bound values per statement.
const ROWS_PER_INSERT = 200;

function chunks<T>(rows: T[]): T[][] {
  return Array.from({ length: Math.ceil(rows.length / ROWS_PER_INSERT) }, (_, i) =>
    rows.slice(i * ROWS_PER_INSERT, (i + 1) * ROWS_PER_INSERT));
}

// Every row of every table, soft-deleted ones included.
export function getAllRowsDb(tx?: TransactionType): Record<keyof typeof TABLES, unknown[]> {
  const db = tx ?? getDb();

  const rows = Object.entries(TABLES).map(([ name, table ]) => [
    name,
    db.select().from(table)
      .all()
  ]);

  return Object.fromEntries(rows) as Record<keyof typeof TABLES, unknown[]>;
}

// Hard-deletes every row and inserts the backup's; call it in a transaction. A
// restore replaces the data outright rather than soft-deleting it, since
// nothing syncs yet (ADR-0003). Inserts are written out per table so each is
// type-checked against its rows.
export function replaceAllRowsDb(tables: BackupTables, tx?: TransactionType): void {
  const db = tx ?? getDb();

  for (const table of Object.values(TABLES).toReversed()) {
    db.delete(table).run();
  }

  for (const rows of chunks(tables.setting)) {
    db.insert(settingTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.exercise)) {
    db.insert(exerciseTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.plan)) {
    db.insert(planTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.workout)) {
    db.insert(workoutTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.block)) {
    db.insert(blockTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.exerciseEntry)) {
    db.insert(exerciseEntryTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.session)) {
    db.insert(sessionTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.loggedSet)) {
    db.insert(loggedSetTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.sessionIncrease)) {
    db.insert(sessionIncreaseTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.aiChange)) {
    db.insert(aiChangeTable).values(rows)
      .run();
  }
}
