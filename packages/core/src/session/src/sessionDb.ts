import {
  eq, getDb, sessionTable
} from "@forklift/db/client";
import type {
  QueryFilters,
  SessionAttributes,
  SessionCreateAttributes,
  TransactionType
} from "@forklift/db/client";

// Sessions read newest first unless asked otherwise.
export function getAllSessionByQuery(
  filters: QueryFilters<"sessionTable">,
  tx?: TransactionType
): SessionAttributes[] {
  const db = tx ?? getDb();

  return db.query.sessionTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? { startedAt: "desc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getSessionByQuery(
  filters: QueryFilters<"sessionTable">,
  tx?: TransactionType
): SessionAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.sessionTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createSessionDb(
  data: SessionCreateAttributes,
  tx?: TransactionType
): SessionAttributes {
  const db = tx ?? getDb();

  const row = db.insert(sessionTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create session");
  }

  return row;
}

export function updateSessionDb(
  id: string,
  data: Partial<SessionCreateAttributes>,
  tx?: TransactionType
): SessionAttributes {
  const db = tx ?? getDb();

  const row = db.update(sessionTable).set(data)
    .where(eq(sessionTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update session ${id}`);
  }

  return row;
}
