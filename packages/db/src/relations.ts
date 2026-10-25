import { defineRelations } from "drizzle-orm";

import {
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  loggedSetTable,
  planTable,
  sessionTable,
  settingTable,
  workoutTable
} from "./schemas";

export const tables = {
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  loggedSetTable,
  planTable,
  sessionTable,
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
      }),
      loggedSets: r.many.loggedSetTable()
    },
    exerciseTable: {
      exerciseEntries: r.many.exerciseEntryTable(),
      loggedSets: r.many.loggedSetTable()
    },
    loggedSetTable: {
      session: r.one.sessionTable({
        from: r.loggedSetTable.sessionId,
        to: r.sessionTable.id,
        optional: false
      }),
      exerciseEntry: r.one.exerciseEntryTable({
        from: r.loggedSetTable.exerciseEntryId,
        to: r.exerciseEntryTable.id,
        optional: false
      }),
      exercise: r.one.exerciseTable({
        from: r.loggedSetTable.exerciseId,
        to: r.exerciseTable.id,
        optional: false
      })
    },
    planTable: { workouts: r.many.workoutTable() },
    sessionTable: {
      workout: r.one.workoutTable({
        from: r.sessionTable.workoutId,
        to: r.workoutTable.id,
        optional: false
      }),
      loggedSets: r.many.loggedSetTable()
    },
    settingTable: {},
    workoutTable: {
      plan: r.one.planTable({
        from: r.workoutTable.planId,
        to: r.planTable.id,
        optional: false
      }),
      blocks: r.many.blockTable(),
      sessions: r.many.sessionTable()
    }
  }));
};
