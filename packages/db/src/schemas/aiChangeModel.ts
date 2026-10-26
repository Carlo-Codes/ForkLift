import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// The planning tables an AI write may change, by SQL name. Sessions, Logged
// Sets and Session increases are never among them.
export const aiChangeTableValues = [
  "plan",
  "workout",
  "block",
  "exerciseEntry",
  "exercise"
] as const;

// One row an AI write touched: the columns it changed, as they were before and
// after. before is null for a row the write created. Values are JSON, so a
// timestamp (only deletedAt changes among these tables) is epoch ms.
export const aiChangeRowSchema = z.object({
  table: z.enum(aiChangeTableValues),
  id: z.uuid(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown())
});

// Synced table (ADR-0003). A Change by AI: one write the AI made through AI
// Access, with a summary for the lifter and the rows it touched, which is what
// Undo puts back. undoneAt is set once it's been undone.
export const aiChangeTable = sqliteTable("aiChange", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  summary: text("summary").notNull(),
  rows: text("rows", { mode: "json" }).$type<AiChangeRow[]>()
    .notNull(),
  undoneAt: integer("undoneAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const aiChangeSchema = createInsertSchema(aiChangeTable, {
  id: z.uuid().optional(),
  rows: () => z.array(aiChangeRowSchema)
});

type AiChangeTable = (typeof aiChangeTableValues)[number];
type AiChangeRow = z.infer<typeof aiChangeRowSchema>;
type AiChangeDbSelect = typeof aiChangeTable.$inferSelect;
type AiChangeDbInsert = typeof aiChangeTable.$inferInsert;
type AiChangeCreateAttributes = z.infer<typeof aiChangeSchema>;
type AiChangeAttributes = Omit<AiChangeCreateAttributes, "id"> & { id: string };

export type {
  AiChangeTable,
  AiChangeRow,
  AiChangeAttributes,
  AiChangeDbSelect,
  AiChangeDbInsert,
  AiChangeCreateAttributes
};
