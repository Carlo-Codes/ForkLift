import {
  eq, getDb, loggedSetTable
} from "@forklift/db/client";
import type {
  LoggedSetAttributes,
  LoggedSetCreateAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

// Logged Sets are history (ADR-0003, GLOSSARY), so there is no delete here.

// Logged Sets read in the order they were done unless asked otherwise; round
// breaks a tie between sets of one entry logged in the same millisecond.
export function getAllLoggedSetByQuery(
  filters: QueryFilters<"loggedSetTable">,
  tx?: TransactionType
): LoggedSetAttributes[] {
  const db = tx ?? getDb();

  return db.query.loggedSetTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? {
      completedAt: "asc",
      round: "asc"
    },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getLoggedSetByQuery(
  filters: QueryFilters<"loggedSetTable">,
  tx?: TransactionType
): LoggedSetAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.loggedSetTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createLoggedSetDb(
  data: LoggedSetCreateAttributes,
  tx?: TransactionType
): LoggedSetAttributes {
  const db = tx ?? getDb();

  const row = db.insert(loggedSetTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create logged set");
  }

  return row;
}

export function updateLoggedSetDb(
  id: string,
  data: Partial<LoggedSetCreateAttributes>,
  tx?: TransactionType
): LoggedSetAttributes {
  const db = tx ?? getDb();

  const row = db.update(loggedSetTable).set(data)
    .where(eq(loggedSetTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update logged set ${id}`);
  }

  return row;
}
