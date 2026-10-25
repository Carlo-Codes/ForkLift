import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

import type { relations } from "./relations";

// Driver-agnostic handle (ADR-0001): `core` runs on the phone against expo-sqlite
// and in Node tests against better-sqlite3. Both are synchronous drizzle SQLite
// databases, so whichever one the host opens is registered here once at startup
// and `core` reads it through getDb() without importing a driver.
export type DatabaseType = SQLiteAsyncDatabase<"sync", unknown, ReturnType<typeof relations>>;

let dbInstance: DatabaseType | undefined;

export function setDb(db: DatabaseType): void {
  dbInstance = db;
}

export function getDb(): DatabaseType {
  if (!dbInstance) {
    throw new Error("No database registered: call setDb() before using @forklift/core");
  }

  return dbInstance;
}
