import type {
  AiChangeAttributes, AiChangeTable, TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { inTransaction } from "#utils/transaction";

import {
  deleteExerciseDb, getExerciseByQuery, updateExerciseDb
} from "../../exercise/src/exerciseDb";
import {
  deletePlanDb, getPlanByQuery, updatePlanDb
} from "../../plan/src/planDb";
import {
  deleteExerciseEntryDb, getExerciseEntryByQuery, updateExerciseEntryDb
} from "../../plan/workout/block/exerciseEntry/src/exerciseEntryDb";
import {
  deleteBlockDb, getBlockByQuery, updateBlockDb
} from "../../plan/workout/block/src/blockDb";
import {
  deleteWorkoutDb, getWorkoutByQuery, updateWorkoutDb
} from "../../plan/workout/src/workoutDb";
import {
  getAiChangeByQuery, getAllAiChangeByQuery, updateAiChangeDb
} from "./aiChangeDb";

const debug = createDebugger("aiChangeService");

type Write = (id: string, data: Record<string, unknown>, tx: TransactionType) => unknown;

const liveRow = (id: string) => ({
  where: {
    id,
    deletedAt: { isNull: true }
  }
} as const);

// How Undo reaches each table the AI can change: whether a row is live, a
// write of some of its columns, and its soft delete, which takes its children
// (and a Plan's Active mark) with it as the lifter deleting it would.
const ROWS: Record<AiChangeTable, {
  isLive: (id: string, tx: TransactionType) => boolean;
  update: Write;
  remove: (id: string, tx: TransactionType) => unknown;
}> = {
  plan: {
    isLive: (id, tx) => !!getPlanByQuery(liveRow(id), tx),
    update: updatePlanDb,
    remove: deletePlanDb
  },
  workout: {
    isLive: (id, tx) => !!getWorkoutByQuery(liveRow(id), tx),
    update: updateWorkoutDb,
    remove: deleteWorkoutDb
  },
  block: {
    isLive: (id, tx) => !!getBlockByQuery(liveRow(id), tx),
    update: updateBlockDb,
    remove: deleteBlockDb
  },
  exerciseEntry: {
    isLive: (id, tx) => !!getExerciseEntryByQuery(liveRow(id), tx),
    update: updateExerciseEntryDb,
    remove: deleteExerciseEntryDb
  },
  exercise: {
    isLive: (id, tx) => !!getExerciseByQuery(liveRow(id), tx),
    update: updateExerciseDb,
    remove: deleteExerciseDb
  }
};

// The recorder keeps timestamps as epoch ms; deletedAt is the only one an AI
// write changes.
const fromJson = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values)
  .map(([ column, value ]) => [ column, column === "deletedAt" && typeof value === "number" ? new Date(value) : value ]));

// Changes by AI, newest first.
export function listAiChanges(tx?: TransactionType): AiChangeAttributes[] {
  return getAllAiChangeByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

export function getAiChange(id: string, tx?: TransactionType): AiChangeAttributes {
  const change = getAiChangeByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!change) {
    throw new ApiError(404, `Change ${id} not found`, "NotFoundError");
  }

  return change;
}

// Puts back what the change touched, last row first: a row it created is
// deleted, and the columns it changed on any other row (deletedAt included, so
// a deletion is restored) go back to how they were. Only those columns, so
// what the lifter has changed since is kept. A change already undone stays as
// it is.
export function undoAiChange(id: string, tx?: TransactionType): AiChangeAttributes {
  return inTransaction(tx, t => {
    const change = getAiChange(id, t);

    if (change.undoneAt) {
      return change;
    }

    debug.info("undoing AI change %s: %s", id, change.summary);

    for (const row of change.rows.toReversed()) {
      const rows = ROWS[ row.table ];

      if (!row.before) {
        if (rows.isLive(row.id, t)) {
          rows.remove(row.id, t);
        }
      } else {
        rows.update(row.id, fromJson(row.before), t);
      }
    }

    return updateAiChangeDb(id, { undoneAt: new Date() }, t);
  });
}
