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
  CREATE TABLE IF NOT EXISTS exercise (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    muscleGroups TEXT NOT NULL,
    equipment TEXT,
    notes TEXT,
    isBuiltIn INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS plan (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    isActive INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS workout (
    id TEXT PRIMARY KEY,
    planId TEXT NOT NULL REFERENCES plan(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS block (
    id TEXT PRIMARY KEY,
    workoutId TEXT NOT NULL REFERENCES workout(id) ON UPDATE CASCADE ON DELETE CASCADE,
    position INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS exerciseEntry (
    id TEXT PRIMARY KEY,
    blockId TEXT NOT NULL REFERENCES block(id) ON UPDATE CASCADE ON DELETE CASCADE,
    exerciseId TEXT NOT NULL REFERENCES exercise(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    targetSets INTEGER NOT NULL,
    targetReps INTEGER NOT NULL,
    targetWeight REAL NOT NULL,
    restSeconds INTEGER NOT NULL,
    weightStep REAL NOT NULL,
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
