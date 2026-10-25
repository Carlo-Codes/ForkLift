import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

// Synced table (ADR-0003): client-generated UUID id, updatedAt and soft delete.
// position orders the Plans list; isActive marks the Active Plan, which the Plan
// service keeps to at most one live row.
export const planTable = sqliteTable("plan", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const planSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim()
    .min(1, "Name is required")
    .max(100),
  position: z.number().int()
    .min(0),
  isActive: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

// What the lifter fills in when adding or renaming a Plan.
export const planCreatePayloadSchema = planSchema.pick({ name: true });

export const planUpdatePayloadSchema = planCreatePayloadSchema.partial();

type PlanDbSelect = typeof planTable.$inferSelect;
type PlanDbInsert = typeof planTable.$inferInsert;
type PlanCreateAttributes = z.infer<typeof planSchema>;
type PlanAttributes = Omit<PlanCreateAttributes, "id"> & { id: string };
type PlanCreatePayload = z.infer<typeof planCreatePayloadSchema>;
type PlanUpdatePayload = z.infer<typeof planUpdatePayloadSchema>;

export type {
  PlanAttributes,
  PlanDbSelect,
  PlanDbInsert,
  PlanCreateAttributes,
  PlanCreatePayload,
  PlanUpdatePayload
};
