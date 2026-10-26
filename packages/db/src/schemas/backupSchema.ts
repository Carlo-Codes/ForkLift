import { z } from "zod";

import { aiChangeSchema } from "./aiChangeModel";
import { blockSchema } from "./blockModel";
import { exerciseEntrySchema } from "./exerciseEntryModel";
import { exerciseSchema } from "./exerciseModel";
import { loggedSetSchema } from "./loggedSetModel";
import { planSchema } from "./planModel";
import { sessionIncreaseSchema } from "./sessionIncreaseModel";
import { sessionSchema } from "./sessionModel";
import { settingSchema } from "./settingModel";
import { workoutSchema } from "./workoutModel";

export const BACKUP_FORMAT = "forklift-backup";
// 2 added Changes by AI; a version 1 file restores with none. 3 added a Logged
// Set's restSkipped; an older file restores with every rest unskipped.
export const BACKUP_VERSION = 3;

// What every backup has, whatever its version, so a file from a newer
// ForkLift can be told apart from a broken one.
export const backupHeaderSchema = z.object({
  format: z.literal(BACKUP_FORMAT, "This file isn't a ForkLift backup"),
  version: z.number("This file isn't a ForkLift backup").int()
    .min(1)
});

// JSON carries dates as strings; a row in a backup is a whole row, id included.
const jsonDate = () => z.coerce.date();

const rowFields = {
  id: z.uuid(),
  createdAt: jsonDate(),
  updatedAt: jsonDate(),
  deletedAt: jsonDate().nullable()
};

// Every table, parents before children, so restoring in this order meets each
// foreign key. A table's key is its SQL name. Tables and rows are strict, so a
// file with a table or column this version doesn't know is rejected rather than
// restored with it dropped: bump BACKUP_VERSION whenever either changes.
export const backupTablesSchema = z.strictObject({
  setting: z.array(settingSchema.extend(rowFields).strict()),
  exercise: z.array(exerciseSchema.extend(rowFields).strict()),
  plan: z.array(planSchema.extend(rowFields).strict()),
  workout: z.array(workoutSchema.extend(rowFields).strict()),
  block: z.array(blockSchema.extend(rowFields).strict()),
  exerciseEntry: z.array(exerciseEntrySchema.extend(rowFields).strict()),
  session: z.array(sessionSchema.extend({
    ...rowFields,
    startedAt: jsonDate(),
    finishedAt: jsonDate().nullable()
  }).strict()),
  loggedSet: z.array(loggedSetSchema.extend({
    ...rowFields,
    completedAt: jsonDate()
  }).strict()),
  sessionIncrease: z.array(sessionIncreaseSchema.extend(rowFields).strict()),
  aiChange: z.array(aiChangeSchema.extend({
    ...rowFields,
    undoneAt: jsonDate().nullable()
  }).strict()).default([])
});

// One versioned JSON document holding every row of every table, soft-deleted
// ones included.
export const backupSchema = backupHeaderSchema.extend({
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(BACKUP_VERSION)
  ]),
  exportedAt: jsonDate(),
  tables: backupTablesSchema
});

type BackupTables = z.infer<typeof backupTablesSchema>;
type BackupDocument = z.infer<typeof backupSchema>;

export type { BackupTables, BackupDocument };
