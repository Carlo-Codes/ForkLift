import {
  integer, real, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { exerciseEntryTable, MAX_TARGET_WEIGHT } from "./exerciseEntryModel";
import { exerciseTable } from "./exerciseModel";
import { sessionTable } from "./sessionModel";

// Synced table (ADR-0003). A set really performed in a Session: round is the
// 1-based set number of its Exercise Entry, and reps and weight are what was
// actually done (weight in the unit chosen in Settings). exerciseId is stored
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
  completedAt: integer("completedAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const loggedSetSchema = z.object({
  id: z.uuid().optional(),
  sessionId: z.uuid(),
  exerciseEntryId: z.uuid(),
  exerciseId: z.uuid(),
  round: z.number().int()
    .min(1),
  reps: z.number("Reps must be a number").int("Reps must be a whole number")
    .min(0, "Reps can't be negative")
    .max(1000),
  weight: z.number("Weight must be a number").min(0, "Weight can't be negative")
    .max(MAX_TARGET_WEIGHT),
  completedAt: z.date(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
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
