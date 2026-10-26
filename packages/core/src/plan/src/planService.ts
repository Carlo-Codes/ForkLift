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
import type { Actor } from "#aiChange/aiChangeRecorder";
import { refuseAi, write } from "#aiChange/aiChangeRecorder";
import { getAllWorkoutByQuery, getWorkoutByQuery } from "#workout/workoutDb";

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

export function createPlan(
  payload: PlanCreatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): PlanAttributes {
  const data = parseOrThrow(planCreatePayloadSchema, payload);

  return write(actor, tx, t => {
    debug.info("creating plan %s", data.name);

    return createPlanDb({
      ...data,
      position: nextPosition(listPlans(t)),
      isActive: false
    }, t);
  }, plan => `Created Plan "${plan.name}"`);
}

export function updatePlan(
  id: string,
  payload: PlanUpdatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): PlanAttributes {
  const data = parseOrThrow(planUpdatePayloadSchema, payload);
  let was = "";

  return write(actor, tx, t => {
    was = getPlan(id, t).name;
    debug.info("updating plan %s", id);

    return updatePlanDb(id, data, t);
  }, plan => `Renamed Plan "${was}" to "${plan.name}"`);
}

// The AI may not delete the Active Plan, as that changes which Plan is Active.
export function deletePlan(id: string, actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    const plan = getPlan(id, t);

    if (plan.isActive) {
      refuseAi(actor, "The AI can't delete the Active Plan");
    }

    debug.info("deleting plan %s", id);
    deletePlanDb(id, t);

    return plan;
  }, plan => `Deleted Plan "${plan.name}"`);
}

// orderedIds lists every live Plan, first to last.
export function reorderPlans(orderedIds: string[], actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    for (const { id, position } of orderOrThrow(listPlans(t), orderedIds)) {
      updatePlanDb(id, { position }, t);
    }
  }, () => "Reordered the Plans");
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
export function setActivePlan(id: string | null, actor: Actor = "lifter", tx?: TransactionType): void {
  refuseAi(actor, "The AI can't change which Plan is Active");

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
