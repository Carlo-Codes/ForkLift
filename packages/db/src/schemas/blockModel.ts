import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { workoutTable } from "./workoutModel";

// Synced table (ADR-0003). position orders the Blocks within their Workout. A
// Block's shape (straight sets or Superset) follows from how many Exercise
// Entries it holds, so it has no columns of its own yet.
export const blockTable = sqliteTable("block", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workoutId: text("workoutId").notNull()
    .references(() => workoutTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    }),
  position: integer("position").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const blockSchema = z.object({
  id: z.uuid().optional(),
  workoutId: z.uuid(),
  position: z.number().int()
    .min(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

type BlockDbSelect = typeof blockTable.$inferSelect;
type BlockDbInsert = typeof blockTable.$inferInsert;
type BlockCreateAttributes = z.infer<typeof blockSchema>;
type BlockAttributes = Omit<BlockCreateAttributes, "id"> & { id: string };

export type {
  BlockAttributes,
  BlockDbSelect,
  BlockDbInsert,
  BlockCreateAttributes
};
