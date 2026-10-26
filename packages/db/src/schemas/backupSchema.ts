import { z } from "zod";

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
export const BACKUP_VERSION = 1;

// What every backup has, whatever its version, so a file from a newer
// ForkLift can be told apart from a broken one.
export const backupHeaderSchema = z.object({
  format: z.literal(BACKUP_FORMAT, "This file isn't a ForkLift backup"),
  version: z.number("This file isn't a ForkLift backup").int()
    .min(1)
});

// JSON carries dates as strings; a row in a backup is a whole row, id included.
const date = () => z.coerce.date();

const rowFields = {
  id: z.uuid(),
  createdAt: date(),
  updatedAt: date(),
  deletedAt: date().nullable()
};

// Every table, parents before children, so restoring in this order meets each
// foreign key. A table's key is its SQL name.
export const backupTablesSchema = z.object({
  setting: z.array(settingSchema.extend(rowFields)),
  exercise: z.array(exerciseSchema.extend(rowFields)),
  plan: z.array(planSchema.extend(rowFields)),
  workout: z.array(workoutSchema.extend(rowFields)),
  block: z.array(blockSchema.extend(rowFields)),
  exerciseEntry: z.array(exerciseEntrySchema.extend(rowFields)),
  session: z.array(sessionSchema.extend({
    ...rowFields,
    startedAt: date(),
    finishedAt: date().nullable()
  })),
  loggedSet: z.array(loggedSetSchema.extend({
    ...rowFields,
    completedAt: date()
  })),
  sessionIncrease: z.array(sessionIncreaseSchema.extend(rowFields))
});

// One versioned JSON document holding every row of every table, soft-deleted
// ones included. The rules core keeps (one Active Plan, one Session in progress,
// one settings row) hold for a backup too.
export const backupSchema = backupHeaderSchema.extend({
  version: z.literal(BACKUP_VERSION),
  exportedAt: date(),
  tables: backupTablesSchema.superRefine((tables, ctx) => {
    const live = <R extends { deletedAt: Date | null }>(rows: R[]): R[] => rows.filter(r => !r.deletedAt);

    if (live(tables.plan).filter(p => p.isActive).length > 1) {
      ctx.addIssue("A backup can have only one Active Plan");
    }

    if (live(tables.session).filter(s => s.status === "inProgress").length > 1) {
      ctx.addIssue("A backup can have only one Session in progress");
    }

    if (live(tables.setting).length > 1) {
      ctx.addIssue("A backup can have only one set of Settings");
    }
  })
});

type BackupTables = z.infer<typeof backupTablesSchema>;
type BackupDocument = z.infer<typeof backupSchema>;

export type { BackupTables, BackupDocument };
