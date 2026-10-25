import {
  integer, sqliteTable, text, uniqueIndex
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { exerciseEntryTable } from "./exerciseEntryModel";
import { sessionTable } from "./sessionModel";

// Synced table (ADR-0003). An Increase Next Time toggle of a Session: one row
// per Exercise Entry the lifter has flipped, on or back off. Finishing the
// Session raises the target weight of every entry left on.
export const sessionIncreaseTable = sqliteTable("sessionIncrease", {
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
  on: integer("on", { mode: "boolean" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
}, table => [ uniqueIndex("sessionIncrease_session_entry_idx").on(table.sessionId, table.exerciseEntryId) ]);

export const sessionIncreaseSchema = createInsertSchema(sessionIncreaseTable, {
  id: z.uuid().optional(),
  sessionId: () => z.uuid(),
  exerciseEntryId: () => z.uuid(),
  on: () => z.boolean("Increase Next Time must be on or off")
});

type SessionIncreaseDbSelect = typeof sessionIncreaseTable.$inferSelect;
type SessionIncreaseDbInsert = typeof sessionIncreaseTable.$inferInsert;
type SessionIncreaseCreateAttributes = z.infer<typeof sessionIncreaseSchema>;
type SessionIncreaseAttributes = Omit<SessionIncreaseCreateAttributes, "id"> & { id: string };

export type {
  SessionIncreaseAttributes,
  SessionIncreaseDbSelect,
  SessionIncreaseDbInsert,
  SessionIncreaseCreateAttributes
};
