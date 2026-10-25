import "./polyfills";

import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import { relations, setDb } from "@forklift/db/client";

// There is no on-device drizzle-kit migration path, so tables are bootstrapped by
// hand. Keep each CREATE TABLE in sync with its table in @forklift/db (and the
// generated SQL in .drizzle/migrations).
const BOOTSTRAP_SQL = `
  CREATE TABLE IF NOT EXISTS setting (
    id TEXT PRIMARY KEY,
    unit TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );
`;

// Opens the phone's database (the source of truth, ADR-0001) and registers it as
// the db @forklift/core uses.
export function openDb() {
  const expoDb = openDatabaseSync("forklift.db", { enableChangeListener: true });

  expoDb.execSync("PRAGMA foreign_keys = ON;");
  expoDb.execSync("PRAGMA journal_mode = WAL;");
  expoDb.execSync(BOOTSTRAP_SQL);

  const db = drizzle(expoDb, { relations: relations() });

  setDb(db);

  return db;
}
