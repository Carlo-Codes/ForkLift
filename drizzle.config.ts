import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

// drizzle-kit resolves relative paths against cwd; anchor to this file so it works
// from the repo root and from packages/db alike.
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: path.join(ROOT_DIR, "./packages/db/src/schemas/*Model.ts"),
  out: path.join(ROOT_DIR, "./.drizzle/migrations"),
  dialect: "sqlite",
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? path.join(ROOT_DIR, "./packages/db/local.db")
  }
});
