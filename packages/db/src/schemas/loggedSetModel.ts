import {
  integer, real, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { exerciseEntryTable, MAX_TARGET_WEIGHT } from "./exerciseEntryModel";
import { exerciseTable } from "./exerciseModel";
import { sessionTable } from "./sessionModel";

// Synced table (ADR-0003). A set of a Session: round is the 1-based set number
// of its Exercise Entry, and reps and weight are what was actually done (weight
// in the unit chosen in Settings), or 0 for a set the lifter skipped, which is
// marked skipped so history can leave it out. exerciseId is stored
// too so history survives edits and deletes in Plans. Never edited by the AI.
export const loggedSetTable = sqliteTable("loggedSet", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("sessionId").notNull()
    .references(() => sessionTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    }),
  exerciseEntryId: text("exerciseEntryId").notNull()
    .references(() => exerciseEntryTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
  exerciseId: text("exerciseId").notNull()
    .references(() => exerciseTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
  round: integer("round").notNull(),
  reps: integer("reps").notNull(),
  weight: real("weight").notNull(),
  // A SQL default so the column can be added to a loggedSet table that shipped without it.
  skipped: integer("skipped", { mode: "boolean" }).notNull()
    .default(false),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const loggedSetSchema = createInsertSchema(loggedSetTable, {
  id: z.uuid().optional(),
  sessionId: () => z.uuid(),
  exerciseEntryId: () => z.uuid(),
  exerciseId: () => z.uuid(),
  round: s => s.min(1),
  reps: () => z.number("Reps must be a number").int("Reps must be a whole number")
    .min(0, "Reps can't be negative")
    .max(1000),
  weight: () => z.number("Weight must be a number").min(0, "Weight can't be negative")
    .max(MAX_TARGET_WEIGHT)
});

// What the lifter actually did, when it differs from the target.
export const completeSetPayloadSchema = loggedSetSchema.pick({
  reps: true,
  weight: true
}).partial();

type LoggedSetDbSelect = typeof loggedSetTable.$inferSelect;
type LoggedSetDbInsert = typeof loggedSetTable.$inferInsert;
type LoggedSetCreateAttributes = z.infer<typeof loggedSetSchema>;
type LoggedSetAttributes = Omit<LoggedSetCreateAttributes, "id"> & { id: string };
type CompleteSetPayload = z.infer<typeof completeSetPayloadSchema>;

export type {
  LoggedSetAttributes,
  LoggedSetDbSelect,
  LoggedSetDbInsert,
  LoggedSetCreateAttributes,
  CompleteSetPayload
};
