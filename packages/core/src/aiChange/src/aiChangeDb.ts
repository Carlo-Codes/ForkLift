import {
  aiChangeTable, eq, getDb
} from "@forklift/db/client";
import type {
  AiChangeAttributes,
  AiChangeCreateAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

// Changes by AI read newest first unless asked otherwise.
export function getAllAiChangeByQuery(
  filters: QueryFilters<"aiChangeTable">,
  tx?: TransactionType
): AiChangeAttributes[] {
  const db = tx ?? getDb();

  return db.query.aiChangeTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? { createdAt: "desc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getAiChangeByQuery(
  filters: QueryFilters<"aiChangeTable">,
  tx?: TransactionType
): AiChangeAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.aiChangeTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createAiChangeDb(
  data: AiChangeCreateAttributes,
  tx?: TransactionType
): AiChangeAttributes {
  const db = tx ?? getDb();

  const row = db.insert(aiChangeTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create AI change");
  }

  return row;
}

export function updateAiChangeDb(
  id: string,
  data: Partial<AiChangeCreateAttributes>,
  tx?: TransactionType
): AiChangeAttributes {
  const db = tx ?? getDb();

  const row = db.update(aiChangeTable).set(data)
    .where(eq(aiChangeTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update AI change ${id}`);
  }

  return row;
}
