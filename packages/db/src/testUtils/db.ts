import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { connectServerDb } from "../connection";

// Fresh, migrated temp-file database registered as the db `core` uses.
export function setupTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forklift-test-"));
  const db = connectServerDb(path.join(tmpDir, "test.db"));

  return {
    db,
    teardown: () => {
      db.$client.close();

      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      });
    }
  };
}
