import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// Synced table (ADR-0003): client-generated UUID id, updatedAt and soft delete.
// position orders the Plans list; isActive marks the Active Plan, which the Plan
// service keeps to at most one live row. nextWorkoutId is the rotation pointer:
// the Workout the home screen offers next, falling back to the first live one
// when it's unset or gone. It has no FK because workout already references plan.
export const planTable = sqliteTable("plan", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull(),
  nextWorkoutId: text("nextWorkoutId"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const planSchema = createInsertSchema(planTable, {
  id: z.uuid().optional(),
  name: s => s.trim().min(1, "Name is required")
    .max(100),
  position: s => s.min(0),
  nextWorkoutId: z.uuid().nullable()
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
