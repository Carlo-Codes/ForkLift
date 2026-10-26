import { defineRelations } from "drizzle-orm";

import {
  aiChangeTable,
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  loggedSetTable,
  planTable,
  sessionIncreaseTable,
  sessionTable,
  settingTable,
  workoutTable
} from "./schemas";

export const tables = {
  aiChangeTable,
  blockTable,
  exerciseEntryTable,
  exerciseTable,
  loggedSetTable,
  planTable,
  sessionIncreaseTable,
  sessionTable,
  settingTable,
  workoutTable
};

export const relations = () => {
  return defineRelations(tables, r => ({
    aiChangeTable: {},
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
      loggedSets: r.many.loggedSetTable(),
      sessionIncreases: r.many.sessionIncreaseTable()
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
    sessionIncreaseTable: {
      session: r.one.sessionTable({
        from: r.sessionIncreaseTable.sessionId,
        to: r.sessionTable.id,
        optional: false
      }),
      exerciseEntry: r.one.exerciseEntryTable({
        from: r.sessionIncreaseTable.exerciseEntryId,
        to: r.exerciseEntryTable.id,
        optional: false
      })
    },
    sessionTable: {
      workout: r.one.workoutTable({
        from: r.sessionTable.workoutId,
        to: r.workoutTable.id,
        optional: false
      }),
      loggedSets: r.many.loggedSetTable(),
      sessionIncreases: r.many.sessionIncreaseTable()
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
