import {
  blockTable, eq, getDb
} from "@forklift/db/client";
import type {
  BlockAttributes,
  BlockCreateAttributes,
  ExerciseAttributes,
  ExerciseEntryAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

import { deleteExerciseEntryDb, getAllExerciseEntryByQuery } from "#exerciseEntry/exerciseEntryDb";

// A Block as the Workout editor shows it: its live Exercise Entries in order,
// each with its Exercise (even a soft-deleted one, so the entry still has a name).
export type BlockWithEntries = BlockAttributes & {
  exerciseEntries: (ExerciseEntryAttributes & { exercise: ExerciseAttributes })[];
};

const withLiveEntries = {
  exerciseEntries: {
    where: { deletedAt: { isNull: true } },
    orderBy: { position: "asc" },
    with: { exercise: true }
  }
} as const;

// Blocks read in their order within the Workout unless asked otherwise.
export function getAllBlockByQuery(
  filters: QueryFilters<"blockTable">,
  tx?: TransactionType
): BlockWithEntries[] {
  const db = tx ?? getDb();

  return db.query.blockTable.findMany({
    columns: filters.columns,
    where: filters.where,
    with: withLiveEntries,
    orderBy: filters.pagination?.orderBy ?? { position: "asc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getBlockByQuery(
  filters: QueryFilters<"blockTable">,
  tx?: TransactionType
): BlockWithEntries | undefined {
  const db = tx ?? getDb();

  return db.query.blockTable.findFirst({
    columns: filters.columns,
    where: filters.where,
    with: withLiveEntries
  }).sync();
}

export function createBlockDb(
  data: BlockCreateAttributes,
  tx?: TransactionType
): BlockAttributes {
  const db = tx ?? getDb();

  const row = db.insert(blockTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create block");
  }

  return row;
}

export function updateBlockDb(
  id: string,
  data: Partial<BlockCreateAttributes>,
  tx?: TransactionType
): BlockAttributes {
  const db = tx ?? getDb();

  const row = db.update(blockTable).set(data)
    .where(eq(blockTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update block ${id}`);
  }

  return row;
}

// Soft delete (ADR-0003) so the deletion can sync; the Block's live Exercise
// Entries go with it. Call inside a transaction.
export function deleteBlockDb(id: string, tx?: TransactionType): BlockAttributes {
  for (const entry of getAllExerciseEntryByQuery({
    where: {
      blockId: id,
      deletedAt: { isNull: true }
    }
  }, tx)) {
    deleteExerciseEntryDb(entry.id, tx);
  }

  return updateBlockDb(id, { deletedAt: new Date() }, tx);
}
