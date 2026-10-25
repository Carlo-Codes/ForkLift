import {
  integer, real, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { blockTable } from "./blockModel";
import { exerciseTable } from "./exerciseModel";
import type { Unit } from "./settingModel";

export const DEFAULT_TARGET_SETS = 3;
export const DEFAULT_TARGET_REPS = 10;
export const DEFAULT_TARGET_WEIGHT = 0;
export const DEFAULT_REST_SECONDS = 90;

export const DEFAULT_WEIGHT_STEP: Record<Unit, number> = {
  kg: 2.5,
  lb: 5
};

// Synced table (ADR-0003). position orders the entries within their Block.
// targetWeight and weightStep are in the unit chosen in Settings; changing the
// unit converts them.
export const exerciseEntryTable = sqliteTable("exerciseEntry", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  blockId: text("blockId").notNull()
    .references(() => blockTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    }),
  exerciseId: text("exerciseId").notNull()
    .references(() => exerciseTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
  position: integer("position").notNull(),
  targetSets: integer("targetSets").notNull(),
  targetReps: integer("targetReps").notNull(),
  targetWeight: real("targetWeight").notNull(),
  restSeconds: integer("restSeconds").notNull(),
  weightStep: real("weightStep").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const exerciseEntrySchema = z.object({
  id: z.uuid().optional(),
  blockId: z.uuid(),
  exerciseId: z.uuid("Pick an exercise"),
  position: z.number().int()
    .min(0),
  targetSets: z.number("Sets must be a number").int("Sets must be a whole number")
    .min(1, "At least 1 set")
    .max(50),
  targetReps: z.number("Reps must be a number").int("Reps must be a whole number")
    .min(1, "At least 1 rep")
    .max(1000),
  targetWeight: z.number("Weight must be a number").min(0, "Weight can't be negative")
    .max(10000),
  restSeconds: z.number("Rest must be a number").int("Rest must be whole seconds")
    .min(0, "Rest can't be negative")
    .max(3600),
  weightStep: z.number("Weight Step must be a number").positive("Weight Step must be above 0")
    .max(1000),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

// What the lifter picks when adding an Exercise Entry; the targets fall back to
// the defaults above (the Weight Step to the one for the current unit).
export const exerciseEntryCreatePayloadSchema = exerciseEntrySchema.pick({
  exerciseId: true,
  targetSets: true,
  targetReps: true,
  targetWeight: true,
  restSeconds: true,
  weightStep: true
}).partial()
  .required({ exerciseId: true });

export const exerciseEntryUpdatePayloadSchema = exerciseEntryCreatePayloadSchema.partial();

type ExerciseEntryDbSelect = typeof exerciseEntryTable.$inferSelect;
type ExerciseEntryDbInsert = typeof exerciseEntryTable.$inferInsert;
type ExerciseEntryCreateAttributes = z.infer<typeof exerciseEntrySchema>;
type ExerciseEntryAttributes = Omit<ExerciseEntryCreateAttributes, "id"> & { id: string };
type ExerciseEntryCreatePayload = z.infer<typeof exerciseEntryCreatePayloadSchema>;
type ExerciseEntryUpdatePayload = z.infer<typeof exerciseEntryUpdatePayloadSchema>;

export type {
  ExerciseEntryAttributes,
  ExerciseEntryDbSelect,
  ExerciseEntryDbInsert,
  ExerciseEntryCreateAttributes,
  ExerciseEntryCreatePayload,
  ExerciseEntryUpdatePayload
};
