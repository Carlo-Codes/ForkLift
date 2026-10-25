import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { connectServerDb } from "../connection";

// Fresh, migrated temp-file database registered as the db `core` uses. reopen
// closes it and opens the same file again, as relaunching the app does.
export function setupTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forklift-test-"));
  const filePath = path.join(tmpDir, "test.db");
  let db = connectServerDb(filePath);

  return {
    get db() {
      return db;
    },
    reopen: () => {
      db.$client.close();
      db = connectServerDb(filePath);
    },
    teardown: () => {
      db.$client.close();

      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      });
    }
  };
}
