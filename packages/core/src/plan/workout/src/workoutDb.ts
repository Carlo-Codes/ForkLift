import {
  eq, getDb, workoutTable
} from "@forklift/db/client";
import type {
  QueryFilters,
  TransactionType,
  WorkoutAttributes,
  WorkoutCreateAttributes
} from "@forklift/db/client";

import { deleteBlockDb, getAllBlockByQuery } from "#block/blockDb";

// Workouts read in the lifter's order unless asked otherwise.
export function getAllWorkoutByQuery(
  filters: QueryFilters<"workoutTable">,
  tx?: TransactionType
): WorkoutAttributes[] {
  const db = tx ?? getDb();

  return db.query.workoutTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? { position: "asc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getWorkoutByQuery(
  filters: QueryFilters<"workoutTable">,
  tx?: TransactionType
): WorkoutAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.workoutTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createWorkoutDb(
  data: WorkoutCreateAttributes,
  tx?: TransactionType
): WorkoutAttributes {
  const db = tx ?? getDb();

  const row = db.insert(workoutTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create workout");
  }

  return row;
}

export function updateWorkoutDb(
  id: string,
  data: Partial<WorkoutCreateAttributes>,
  tx?: TransactionType
): WorkoutAttributes {
  const db = tx ?? getDb();

  const row = db.update(workoutTable).set(data)
    .where(eq(workoutTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update workout ${id}`);
  }

  return row;
}

// Soft delete (ADR-0003): the row stays so past Sessions keep their Workout and
// the deletion can sync. Its live Blocks go with it. Call inside a transaction.
export function deleteWorkoutDb(id: string, tx?: TransactionType): WorkoutAttributes {
  for (const block of getAllBlockByQuery({
    where: {
      workoutId: id,
      deletedAt: { isNull: true }
    }
  }, tx)) {
    deleteBlockDb(block.id, tx);
  }

  return updateWorkoutDb(id, { deletedAt: new Date() }, tx);
}
