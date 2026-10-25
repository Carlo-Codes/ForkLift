import {
  eq, getDb, settingTable
} from "@forklift/db/client";
import type {
  QueryFilters,
  SettingAttributes,
  SettingCreateAttributes,
  TransactionType
} from "@forklift/db/client";

// Both drivers (expo-sqlite, better-sqlite3) are synchronous, so queries run with
// .sync()/.get() and services can compose inside getDb().transaction(tx => …),
// which rejects async callbacks on sync drivers.
export function getSettingByQuery(
  filters: QueryFilters<"settingTable">,
  tx?: TransactionType
): SettingAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.settingTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createSettingDb(
  data: SettingCreateAttributes,
  tx?: TransactionType
): SettingAttributes {
  const db = tx ?? getDb();

  const row = db.insert(settingTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create setting");
  }

  return row;
}

export function updateSettingDb(
  id: string,
  data: Partial<SettingCreateAttributes>,
  tx?: TransactionType
): SettingAttributes {
  const db = tx ?? getDb();

  const row = db.update(settingTable).set(data)
    .where(eq(settingTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update setting ${id}`);
  }

  return row;
}
