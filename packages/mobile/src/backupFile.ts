import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { exportBackup } from "@forklift/core";

// Writes the backup to a file and opens the share sheet, so the lifter can save
// it anywhere: the Files app, a cloud drive or another app.
export async function shareBackup(): Promise<void> {
  const file = new File(Paths.cache, `forklift-backup-${new Date().toISOString()
    .slice(0, 10)}.json`);

  file.create({ overwrite: true });
  file.writeSync(exportBackup());

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "Save your ForkLift backup"
  });
}

// The text of a file the lifter picks, or undefined if they cancel. Any file
// may be picked: cloud drives often don't label JSON as such, and
// @forklift/core rejects anything that isn't a backup.
export async function pickBackupText(): Promise<string | undefined> {
  const picked = await File.pickFileAsync();

  return picked.canceled ? undefined : picked.result.text();
}
