# Entity zod schemas are generated from the Drizzle tables

The blueprint said to hand-write each `<entity>Schema` to match the table's insert shape. With
eight synced tables and more coming, those copies can drift from the tables: a new column, or a
change to whether one is nullable or has a default, has to be edited in two places. Nothing
catches a miss. So we generate the schemas with `createInsertSchema` from `drizzle-orm/zod`. It's
part of Drizzle 1.0 itself; the separate `drizzle-zod` package is deprecated there. The table
supplies each column's type, nullability and optionality, and the model file adds only what SQL
can't express: uuids, ranges, trims and user-facing messages.

One quirk in `1.0.0-rc.5`: a function refinement on a column that has a default or is nullable is
typed as required, though at runtime it's optional. Those columns (`id`, and a few nullable ones)
are refined with a full schema that states its optionality. Revisit this when Drizzle 1.0 ships
stable.
