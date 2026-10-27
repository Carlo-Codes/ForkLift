import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// A calendar day, not an instant, so it can't shift with the phone's time zone.
const calendarDay = () => z.iso.date("Dates must be a calendar day, YYYY-MM-DD").nullable()
  .optional();

// Synced table (ADR-0003): client-generated UUID id, updatedAt and soft delete.
// position orders the Plans list; isActive marks the Active Plan, which the Plan
// service keeps to at most one live row. nextWorkoutId is the rotation pointer:
// the Workout the home screen offers next, falling back to the first live one
// when it's unset or gone. It has no FK because workout already references plan.
// startDate and endDate are the Plan's optional From and To dates: calendar days
// as YYYY-MM-DD text, shown to the lifter but never choosing the Active Plan
// (ADR-0006).
export const planTable = sqliteTable("plan", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull(),
  nextWorkoutId: text("nextWorkoutId"),
  startDate: text("startDate"),
  endDate: text("endDate"),
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
    .optional(),
  startDate: calendarDay(),
  endDate: calendarDay()
});

// Whether a Plan's To date is on or after its From date, or either is unset.
// YYYY-MM-DD strings compare in calendar order.
export const isPlanDateOrder = ({ startDate, endDate }: {
  startDate?: string | null;
  endDate?: string | null;
}) => !startDate || !endDate || endDate >= startDate;

export const PLAN_DATE_ORDER_MESSAGE = "The To date must be on or after the From date";

const planPayloadFields = planSchema.pick({
  name: true,
  startDate: true,
  endDate: true
});

// What the lifter fills in when adding a Plan. Omitted dates are unset.
export const planCreatePayloadSchema = planPayloadFields.refine(isPlanDateOrder, {
  message: PLAN_DATE_ORDER_MESSAGE,
  path: [ "endDate" ]
});

// What changes when editing a Plan: a date set to null is cleared, an omitted
// one is left alone. The Plan service checks the date order against the dates
// already saved.
export const planUpdatePayloadSchema = planPayloadFields.partial();

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
