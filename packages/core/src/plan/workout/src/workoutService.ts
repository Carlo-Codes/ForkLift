import { workoutCreatePayloadSchema, workoutUpdatePayloadSchema } from "@forklift/db/client";
import type {
  TransactionType,
  WorkoutAttributes,
  WorkoutCreatePayload,
  WorkoutUpdatePayload
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "../../../utils/position";
import { inTransaction } from "../../../utils/transaction";
import { parseOrThrow } from "../../../utils/validation";
import { getPlan } from "../../src/planService";
import {
  createWorkoutDb,
  deleteWorkoutDb,
  getAllWorkoutByQuery,
  getWorkoutByQuery,
  updateWorkoutDb
} from "./workoutDb";

const debug = createDebugger("workoutService");

export function listWorkouts(planId: string, tx?: TransactionType): WorkoutAttributes[] {
  getPlan(planId, tx);

  return getAllWorkoutByQuery({
    where: {
      planId,
      deletedAt: { isNull: true }
    }
  }, tx);
}

export function getWorkout(id: string, tx?: TransactionType): WorkoutAttributes {
  const workout = getWorkoutByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!workout) {
    throw new ApiError(404, `Workout ${id} not found`, "NotFoundError");
  }

  return workout;
}

export function createWorkout(
  planId: string,
  payload: WorkoutCreatePayload,
  tx?: TransactionType
): WorkoutAttributes {
  const data = parseOrThrow(workoutCreatePayloadSchema, payload);

  debug.info("creating workout %s in plan %s", data.name, planId);

  return createWorkoutDb({
    ...data,
    planId,
    position: nextPosition(listWorkouts(planId, tx))
  }, tx);
}

export function updateWorkout(
  id: string,
  payload: WorkoutUpdatePayload,
  tx?: TransactionType
): WorkoutAttributes {
  const data = parseOrThrow(workoutUpdatePayloadSchema, payload);

  getWorkout(id, tx);
  debug.info("updating workout %s", id);

  return updateWorkoutDb(id, data, tx);
}

export function deleteWorkout(id: string, tx?: TransactionType): void {
  inTransaction(tx, t => {
    getWorkout(id, t);
    debug.info("deleting workout %s", id);
    deleteWorkoutDb(id, t);
  });
}

// orderedIds lists every live Workout in the Plan, first to last.
export function reorderWorkouts(planId: string, orderedIds: string[], tx?: TransactionType): void {
  inTransaction(tx, t => {
    for (const { id, position } of orderOrThrow(listWorkouts(planId, t), orderedIds)) {
      updateWorkoutDb(id, { position }, t);
    }
  });
}
