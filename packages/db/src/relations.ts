import { defineRelations } from "drizzle-orm";

import { settingTable } from "./schemas";

export const tables = { settingTable };

export const relations = () => {
  return defineRelations(tables, () => ({ settingTable: {} }));
};
