import {
  eq, getDb, sessionIncreaseTable
} from "@forklift/db/client";
import type {
  QueryFilters,
  SessionIncreaseAttributes,
  SessionIncreaseCreateAttributes,
  TransactionType
} from "@forklift/db/client";

export function getAllSessionIncreaseByQuery(
  filters: QueryFilters<"sessionIncreaseTable">,
  tx?: TransactionType
): SessionIncreaseAttributes[] {
  const db = tx ?? getDb();

  return db.query.sessionIncreaseTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy,
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getSessionIncreaseByQuery(
  filters: QueryFilters<"sessionIncreaseTable">,
  tx?: TransactionType
): SessionIncreaseAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.sessionIncreaseTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createSessionIncreaseDb(
  data: SessionIncreaseCreateAttributes,
  tx?: TransactionType
): SessionIncreaseAttributes {
  const db = tx ?? getDb();

  const row = db.insert(sessionIncreaseTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create session increase");
  }

  return row;
}

export function updateSessionIncreaseDb(
  id: string,
  data: Partial<SessionIncreaseCreateAttributes>,
  tx?: TransactionType
): SessionIncreaseAttributes {
  const db = tx ?? getDb();

  const row = db.update(sessionIncreaseTable).set(data)
    .where(eq(sessionIncreaseTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update session increase ${id}`);
  }

  return row;
}
