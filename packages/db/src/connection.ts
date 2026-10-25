import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { setDb } from "./database";
import { relations } from "./relations";

const DEFAULT_DB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../local.db"
);

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.drizzle/migrations"
);

// Opens a better-sqlite3 database (DATABASE_URL, else packages/db/local.db),
// migrates it and registers it as the db `core` uses.
export function connectServerDb(filePath = process.env.DATABASE_URL ?? DEFAULT_DB_PATH) {
  const client = new Database(filePath);

  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");
  client.pragma("busy_timeout = 5000");

  const db = drizzle({
    client,
    relations: relations()
  });

  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  setDb(db);

  return db;
}
