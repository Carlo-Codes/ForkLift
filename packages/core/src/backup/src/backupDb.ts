import {
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
  sessionIncrease: sessionIncreaseTable
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

  return {
    setting: db.select().from(settingTable)
      .all(),
    exercise: db.select().from(exerciseTable)
      .all(),
    plan: db.select().from(planTable)
      .all(),
    workout: db.select().from(workoutTable)
      .all(),
    block: db.select().from(blockTable)
      .all(),
    exerciseEntry: db.select().from(exerciseEntryTable)
      .all(),
    session: db.select().from(sessionTable)
      .all(),
    loggedSet: db.select().from(loggedSetTable)
      .all(),
    sessionIncrease: db.select().from(sessionIncreaseTable)
      .all()
  };
}

// Hard-deletes every row and inserts the backup's. A restore replaces the data
// outright rather than soft-deleting it: nothing syncs yet (ADR-0003).
export function replaceAllRowsDb(tables: BackupTables, tx: TransactionType): void {
  for (const table of Object.values(TABLES).toReversed()) {
    tx.delete(table).run();
  }

  for (const rows of chunks(tables.setting)) {
    tx.insert(settingTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.exercise)) {
    tx.insert(exerciseTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.plan)) {
    tx.insert(planTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.workout)) {
    tx.insert(workoutTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.block)) {
    tx.insert(blockTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.exerciseEntry)) {
    tx.insert(exerciseEntryTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.session)) {
    tx.insert(sessionTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.loggedSet)) {
    tx.insert(loggedSetTable).values(rows)
      .run();
  }

  for (const rows of chunks(tables.sessionIncrease)) {
    tx.insert(sessionIncreaseTable).values(rows)
      .run();
  }
}
