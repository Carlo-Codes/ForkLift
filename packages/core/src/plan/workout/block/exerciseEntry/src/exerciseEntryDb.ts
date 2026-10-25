import {
  eq, exerciseEntryTable, getDb
} from "@forklift/db/client";
import type {
  ExerciseEntryAttributes,
  ExerciseEntryCreateAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

// Exercise Entries read in their order within the Block unless asked otherwise.
export function getAllExerciseEntryByQuery(
  filters: QueryFilters<"exerciseEntryTable">,
  tx?: TransactionType
): ExerciseEntryAttributes[] {
  const db = tx ?? getDb();

  return db.query.exerciseEntryTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? { position: "asc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getExerciseEntryByQuery(
  filters: QueryFilters<"exerciseEntryTable">,
  tx?: TransactionType
): ExerciseEntryAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.exerciseEntryTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createExerciseEntryDb(
  data: ExerciseEntryCreateAttributes,
  tx?: TransactionType
): ExerciseEntryAttributes {
  const db = tx ?? getDb();

  const row = db.insert(exerciseEntryTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create exercise entry");
  }

  return row;
}

export function updateExerciseEntryDb(
  id: string,
  data: Partial<ExerciseEntryCreateAttributes>,
  tx?: TransactionType
): ExerciseEntryAttributes {
  const db = tx ?? getDb();

  const row = db.update(exerciseEntryTable).set(data)
    .where(eq(exerciseEntryTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update exercise entry ${id}`);
  }

  return row;
}

// Soft delete (ADR-0003) so the deletion can sync.
export function deleteExerciseEntryDb(id: string, tx?: TransactionType): ExerciseEntryAttributes {
  return updateExerciseEntryDb(id, { deletedAt: new Date() }, tx);
}
