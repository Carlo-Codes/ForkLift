import { planCreatePayloadSchema, planUpdatePayloadSchema } from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreatePayload,
  PlanUpdatePayload,
  TransactionType,
  WorkoutAttributes
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";

import { getAllWorkoutByQuery, getWorkoutByQuery } from "../workout/src/workoutDb";
import {
  createPlanDb,
  deletePlanDb,
  getAllPlanByQuery,
  getPlanByQuery,
  updatePlanDb
} from "./planDb";

const debug = createDebugger("planService");

export function listPlans(tx?: TransactionType): PlanAttributes[] {
  return getAllPlanByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

// Soft-deleted Plans are gone as far as the lifter is concerned.
export function getPlan(id: string, tx?: TransactionType): PlanAttributes {
  const plan = getPlanByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!plan) {
    throw new ApiError(404, `Plan ${id} not found`, "NotFoundError");
  }

  return plan;
}

export function createPlan(payload: PlanCreatePayload, tx?: TransactionType): PlanAttributes {
  const data = parseOrThrow(planCreatePayloadSchema, payload);

  debug.info("creating plan %s", data.name);

  return createPlanDb({
    ...data,
    position: nextPosition(listPlans(tx)),
    isActive: false
  }, tx);
}

export function updatePlan(
  id: string,
  payload: PlanUpdatePayload,
  tx?: TransactionType
): PlanAttributes {
  const data = parseOrThrow(planUpdatePayloadSchema, payload);

  getPlan(id, tx);
  debug.info("updating plan %s", id);

  return updatePlanDb(id, data, tx);
}

export function deletePlan(id: string, tx?: TransactionType): void {
  inTransaction(tx, t => {
    getPlan(id, t);
    debug.info("deleting plan %s", id);
    deletePlanDb(id, t);
  });
}

// orderedIds lists every live Plan, first to last.
export function reorderPlans(orderedIds: string[], tx?: TransactionType): void {
  inTransaction(tx, t => {
    for (const { id, position } of orderOrThrow(listPlans(t), orderedIds)) {
      updatePlanDb(id, { position }, t);
    }
  });
}

export function getActivePlan(tx?: TransactionType): PlanAttributes | undefined {
  return getPlanByQuery({
    where: {
      isActive: true,
      deletedAt: { isNull: true }
    }
  }, tx);
}

// Makes id the one Active Plan, or leaves none Active when id is null.
export function setActivePlan(id: string | null, tx?: TransactionType): void {
  inTransaction(tx, t => {
    if (id) {
      getPlan(id, t);
    }

    debug.info("setting active plan to %s", id);

    for (const plan of getAllPlanByQuery({ where: { isActive: true } }, t)) {
      updatePlanDb(plan.id, { isActive: false }, t);
    }

    if (id) {
      updatePlanDb(id, { isActive: true }, t);
    }
  });
}

function listLiveWorkouts(planId: string, tx?: TransactionType): WorkoutAttributes[] {
  return getAllWorkoutByQuery({
    where: {
      planId,
      deletedAt: { isNull: true }
    }
  }, tx);
}

// The Workout the home screen offers to Start: the Active Plan's rotation
// pointer, or its first Workout when the pointer is unset or no longer live.
// None without an Active Plan or with no Workouts in it.
export function getNextWorkout(tx?: TransactionType): WorkoutAttributes | undefined {
  const plan = getActivePlan(tx);

  if (!plan) {
    return undefined;
  }

  const workouts = listLiveWorkouts(plan.id, tx);

  return workouts.find(w => w.id === plan.nextWorkoutId) ?? workouts[ 0 ];
}

// Points the rotation of the Workout's Plan at the Workout after it, wrapping
// round to the first. Called when a Session finishes, so a Workout the lifter
// chose out of turn moves the rotation on from there. A Workout deleted since
// leaves the rotation where it was.
export function advanceRotation(workoutId: string, tx?: TransactionType): void {
  const workout = getWorkoutByQuery({ where: { id: workoutId } }, tx);

  if (!workout) {
    return;
  }

  const workouts = listLiveWorkouts(workout.planId, tx);
  const index = workouts.findIndex(w => w.id === workoutId);

  if (index === -1) {
    return;
  }

  const next = workouts[ (index + 1) % workouts.length ]!;

  debug.info("advancing rotation of plan %s to workout %s", workout.planId, next.id);
  updatePlanDb(workout.planId, { nextWorkoutId: next.id }, tx);
}
