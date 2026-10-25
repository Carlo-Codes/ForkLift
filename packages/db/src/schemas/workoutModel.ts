import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { planTable } from "./planModel";

// Synced table (ADR-0003). position orders the Workouts within their Plan.
export const workoutTable = sqliteTable("workout", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text("planId").notNull()
    .references(() => planTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const workoutSchema = z.object({
  id: z.uuid().optional(),
  planId: z.uuid(),
  name: z.string().trim()
    .min(1, "Name is required")
    .max(100),
  position: z.number().int()
    .min(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

// What the lifter fills in when adding or renaming a Workout.
export const workoutCreatePayloadSchema = workoutSchema.pick({ name: true });

export const workoutUpdatePayloadSchema = workoutCreatePayloadSchema.partial();

type WorkoutDbSelect = typeof workoutTable.$inferSelect;
type WorkoutDbInsert = typeof workoutTable.$inferInsert;
type WorkoutCreateAttributes = z.infer<typeof workoutSchema>;
type WorkoutAttributes = Omit<WorkoutCreateAttributes, "id"> & { id: string };
type WorkoutCreatePayload = z.infer<typeof workoutCreatePayloadSchema>;
type WorkoutUpdatePayload = z.infer<typeof workoutUpdatePayloadSchema>;

export type {
  WorkoutAttributes,
  WorkoutDbSelect,
  WorkoutDbInsert,
  WorkoutCreateAttributes,
  WorkoutCreatePayload,
  WorkoutUpdatePayload
};
