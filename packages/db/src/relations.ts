import { defineRelations } from "drizzle-orm";

import { exerciseTable, settingTable } from "./schemas";

export const tables = {
  exerciseTable,
  settingTable
};

export const relations = () => {
  return defineRelations(tables, () => ({
    exerciseTable: {},
    settingTable: {}
  }));
};
