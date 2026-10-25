import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

// Closed lists rather than tables: muscles and gym kit barely change, and fixed
// lists give the UI chips and AI Access the valid values. Add new ones here.
export const muscleGroupValues = [
  "chest",
  "back",
  "lats",
  "traps",
  "shoulders",
  "rear delts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "lower back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves"
] as const;

export const equipmentValues = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "ez bar",
  "trap bar",
  "smith machine",
  "machine",
  "cable",
  "band",
  "bodyweight",
  "other"
] as const;

// Synced table (ADR-0003): client-generated UUID id, updatedAt and soft delete.
// isBuiltIn records provenance only; built-in and custom Exercises behave the same.
export const exerciseTable = sqliteTable("exercise", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  muscleGroups: text("muscleGroups", { mode: "json" }).$type<MuscleGroup[]>()
    .notNull(),
  equipment: text("equipment", { enum: equipmentValues }),
  notes: text("notes"),
  isBuiltIn: integer("isBuiltIn", { mode: "boolean" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const exerciseSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim()
    .min(1, "Name is required")
    .max(100),
  muscleGroups: z.array(z.enum(muscleGroupValues)).max(muscleGroupValues.length),
  equipment: z.enum(equipmentValues).nullable()
    .optional(),
  notes: z.string().max(2000)
    .nullable()
    .optional(),
  isBuiltIn: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

// What the lifter fills in when adding or editing an Exercise.
export const exerciseCreatePayloadSchema = exerciseSchema.pick({
  name: true,
  muscleGroups: true,
  equipment: true,
  notes: true
});

export const exerciseUpdatePayloadSchema = exerciseCreatePayloadSchema.partial();

type Equipment = (typeof equipmentValues)[number];
type MuscleGroup = (typeof muscleGroupValues)[number];
type ExerciseDbSelect = typeof exerciseTable.$inferSelect;
type ExerciseDbInsert = typeof exerciseTable.$inferInsert;
type ExerciseCreateAttributes = z.infer<typeof exerciseSchema>;
type ExerciseAttributes = Omit<ExerciseCreateAttributes, "id"> & { id: string };
type ExerciseCreatePayload = z.infer<typeof exerciseCreatePayloadSchema>;
type ExerciseUpdatePayload = z.infer<typeof exerciseUpdatePayloadSchema>;

export type {
  Equipment,
  MuscleGroup,
  ExerciseAttributes,
  ExerciseDbSelect,
  ExerciseDbInsert,
  ExerciseCreateAttributes,
  ExerciseCreatePayload,
  ExerciseUpdatePayload
};
