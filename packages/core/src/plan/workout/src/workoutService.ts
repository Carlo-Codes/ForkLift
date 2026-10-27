import { workoutCreatePayloadSchema, workoutUpdatePayloadSchema } from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreatePayload,
  TransactionType,
  WorkoutAttributes,
  WorkoutCreatePayload,
  WorkoutUpdatePayload
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { write } from "#aiChange/aiChangeRecorder";
import { createPlan, getPlan } from "#plan/planService";

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
  actor: Actor = "lifter",
  tx?: TransactionType
): WorkoutAttributes {
  const data = parseOrThrow(workoutCreatePayloadSchema, payload);

  return write(actor, tx, t => {
    debug.info("creating workout %s in plan %s", data.name, planId);

    return createWorkoutDb({
      ...data,
      planId,
      position: nextPosition(listWorkouts(planId, t))
    }, t);
  }, (workout, t) => `Added Workout "${workout.name}" to Plan "${getPlan(planId, t).name}"`);
}

// The Workouts a Plan made in the Plan editor starts with, empty.
export const DEFAULT_WORKOUT_NAMES = [
  "Push",
  "Pull",
  "Legs"
] as const;

// A Plan as the lifter creates it in the Plan editor: with the default
// Workouts, all or nothing. It lives here rather than in planService, which
// workoutService already depends on. The AI's create_plan makes an empty Plan.
export function createPlanWithDefaultWorkouts(
  payload: PlanCreatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): PlanAttributes {
  return inTransaction(tx, t => {
    const plan = createPlan(payload, actor, t);

    for (const name of DEFAULT_WORKOUT_NAMES) {
      createWorkout(plan.id, { name }, actor, t);
    }

    return plan;
  });
}

// The Workout "+" adds in the Plan editor, named "Day N" for the place it takes,
// or the next N free when the Plan already has a Workout of that name.
export function createNextDayWorkout(planId: string, tx?: TransactionType): WorkoutAttributes {
  return inTransaction(tx, t => {
    const workouts = listWorkouts(planId, t);
    const names = new Set(workouts.map(w => w.name));
    let day = workouts.length + 1;

    while (names.has(`Day ${day}`)) {
      day++;
    }

    return createWorkout(planId, { name: `Day ${day}` }, "lifter", t);
  });
}

export function updateWorkout(
  id: string,
  payload: WorkoutUpdatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): WorkoutAttributes {
  const data = parseOrThrow(workoutUpdatePayloadSchema, payload);
  let was = "";

  return write(actor, tx, t => {
    was = getWorkout(id, t).name;
    debug.info("updating workout %s", id);

    return updateWorkoutDb(id, data, t);
  }, workout => `Renamed Workout "${was}" to "${workout.name}"`);
}

export function deleteWorkout(id: string, actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    const workout = getWorkout(id, t);

    debug.info("deleting workout %s", id);
    deleteWorkoutDb(id, t);

    return workout;
  }, (workout, t) => `Deleted Workout "${workout.name}" from Plan "${getPlan(workout.planId, t).name}"`);
}

// orderedIds lists every live Workout in the Plan, first to last.
export function reorderWorkouts(
  planId: string,
  orderedIds: string[],
  actor: Actor = "lifter",
  tx?: TransactionType
): void {
  write(actor, tx, t => {
    for (const { id, position } of orderOrThrow(listWorkouts(planId, t), orderedIds)) {
      updateWorkoutDb(id, { position }, t);
    }
  }, (_, t) => `Reordered the Workouts of Plan "${getPlan(planId, t).name}"`);
}
