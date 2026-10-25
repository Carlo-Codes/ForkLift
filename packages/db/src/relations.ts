import { defineRelations } from "drizzle-orm";

import {
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  planTable,
  settingTable,
  workoutTable
} from "./schemas";

export const tables = {
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  planTable,
  settingTable,
  workoutTable
};

export const relations = () => {
  return defineRelations(tables, r => ({
    blockTable: {
      workout: r.one.workoutTable({
        from: r.blockTable.workoutId,
        to: r.workoutTable.id,
        optional: false
      }),
      exerciseEntries: r.many.exerciseEntryTable()
    },
    exerciseEntryTable: {
      block: r.one.blockTable({
        from: r.exerciseEntryTable.blockId,
        to: r.blockTable.id,
        optional: false
      }),
      exercise: r.one.exerciseTable({
        from: r.exerciseEntryTable.exerciseId,
        to: r.exerciseTable.id,
        optional: false
      })
    },
    exerciseTable: { exerciseEntries: r.many.exerciseEntryTable() },
    planTable: { workouts: r.many.workoutTable() },
    settingTable: {},
    workoutTable: {
      plan: r.one.planTable({
        from: r.workoutTable.planId,
        to: r.planTable.id,
        optional: false
      }),
      blocks: r.many.blockTable()
    }
  }));
};
