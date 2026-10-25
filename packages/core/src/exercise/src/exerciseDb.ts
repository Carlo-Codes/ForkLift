import {
  eq, exerciseTable, getDb, sql
} from "@forklift/db/client";
import type {
  ExerciseAttributes,
  ExerciseCreateAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

// Exercises read alphabetically unless asked otherwise, ignoring case so a
// lifter's lowercase "cable fly" doesn't sink below every capitalised name.
export function getAllExerciseByQuery(
  filters: QueryFilters<"exerciseTable">,
  tx?: TransactionType
): ExerciseAttributes[] {
  const db = tx ?? getDb();

  return db.query.exerciseTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? (t => sql`${t.name} COLLATE NOCASE`),
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getExerciseByQuery(
  filters: QueryFilters<"exerciseTable">,
  tx?: TransactionType
): ExerciseAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.exerciseTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createExerciseDb(
  data: ExerciseCreateAttributes,
  tx?: TransactionType
): ExerciseAttributes {
  const db = tx ?? getDb();

  const row = db.insert(exerciseTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create exercise");
  }

  return row;
}

export function updateExerciseDb(
  id: string,
  data: Partial<ExerciseCreateAttributes>,
  tx?: TransactionType
): ExerciseAttributes {
  const db = tx ?? getDb();

  const row = db.update(exerciseTable).set(data)
    .where(eq(exerciseTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update exercise ${id}`);
  }

  return row;
}

// Soft delete (ADR-0003): the row stays so Logged Sets keep their Exercise and the
// deletion can sync.
export function deleteExerciseDb(id: string, tx?: TransactionType): ExerciseAttributes {
  return updateExerciseDb(id, { deletedAt: new Date() }, tx);
}
