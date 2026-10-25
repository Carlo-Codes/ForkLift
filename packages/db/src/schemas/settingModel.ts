import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const unitValues = [ "kg", "lb" ] as const;

// Synced table (ADR-0003): client-generated UUID id, updatedAt and soft delete.
// Ids and timestamps are generated in JS so the phone and the test DB agree
// without SQL defaults that would also need mirroring in the on-device bootstrap.
export const settingTable = sqliteTable("setting", {
  id: text("id").primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  unit: text("unit", { enum: unitValues }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
});

export const settingSchema = z.object({
  id: z.uuid().optional(),
  unit: z.enum(unitValues),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().nullable()
    .optional()
});

type Unit = (typeof unitValues)[number];
type SettingDbSelect = typeof settingTable.$inferSelect;
type SettingDbInsert = typeof settingTable.$inferInsert;
type SettingCreateAttributes = z.infer<typeof settingSchema>;
type SettingAttributes = Omit<SettingCreateAttributes, "id"> & { id: string };

export type {
  Unit,
  SettingAttributes,
  SettingDbSelect,
  SettingDbInsert,
  SettingCreateAttributes
};
