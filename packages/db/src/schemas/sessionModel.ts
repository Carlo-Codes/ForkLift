import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { workoutTable } from "./workoutModel";

export const sessionStatusValues = [ "inProgress", "finished" ] as const;

// One Exercise Entry as the Session saw it at Start. Workout Mode runs from this
// snapshot, so editing the Workout mid-Session only changes the next Session.
export const sessionEntrySnapshotSchema = z.object({
  exerciseEntryId: z.uuid(),
  exerciseId: z.uuid(),
  exerciseName: z.string(),
  targetSets: z.number().int()
    .min(1),
  targetReps: z.number().int()
    .min(1),
  targetWeight: z.number().min(0),
  restSeconds: z.number().int()
    .min(0)
});

// Synced table (ADR-0003). blocks holds the Workout's Blocks in order, each its
// Exercise Entries in order, as snapshotted at Start; targetWeight is in the unit
// chosen in Settings and converts with it. Sessions are history: they are never
// edited by the AI and outlive their Workout, hence restrict.
export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workoutId: text("workoutId").notNull()
    .references(() => workoutTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
  status: text("status", { enum: sessionStatusValues }).notNull(),
  blocks: text("blocks", { mode: "json" }).$type<SessionEntrySnapshot[][]>()
    .notNull(),
  startedAt: integer("startedAt", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finishedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const sessionSchema = z.object({
  id: z.uuid().optional(),
  workoutId: z.uuid(),
  status: z.enum(sessionStatusValues),
  blocks: z.array(z.array(sessionEntrySnapshotSchema)),
  startedAt: z.date(),
  finishedAt: z.date().nullable()
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

type SessionStatus = (typeof sessionStatusValues)[number];
type SessionEntrySnapshot = z.infer<typeof sessionEntrySnapshotSchema>;
type SessionDbSelect = typeof sessionTable.$inferSelect;
type SessionDbInsert = typeof sessionTable.$inferInsert;
type SessionCreateAttributes = z.infer<typeof sessionSchema>;
type SessionAttributes = Omit<SessionCreateAttributes, "id"> & { id: string };

export type {
  SessionStatus,
  SessionEntrySnapshot,
  SessionAttributes,
  SessionDbSelect,
  SessionDbInsert,
  SessionCreateAttributes
};
