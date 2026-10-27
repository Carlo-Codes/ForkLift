import {
  PLAN_DATE_ORDER_MESSAGE, isPlanDateOrder, planCreatePayloadSchema, planUpdatePayloadSchema
} from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreatePayload,
  PlanUpdatePayload,
  TransactionType,
  WorkoutAttributes
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition } from "#utils/position";
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

// Newest first.
export function listPlans(tx?: TransactionType): PlanAttributes[] {
  return getAllPlanByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

// A Plan as the Plans list shows it. ended is true once its To date has
// passed; the Plan keeps its place in the list (ADR-0006).
export type PlanCard = Pick<PlanAttributes, "id" | "name" | "isActive"> & {
  startDate: string | null;
  endDate: string | null;
  ended: boolean;
  workoutNames: string[];
};

// A Date as the calendar day it falls on where the phone is, e.g. "2026-10-27".
export function toCalendarDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The Plans list, newest first. today is a YYYY-MM-DD calendar day.
export function listPlanCards(today = toCalendarDay(new Date()), tx?: TransactionType): PlanCard[] {
  return listPlans(tx).map(plan => ({
    id: plan.id,
    name: plan.name,
    startDate: plan.startDate ?? null,
    endDate: plan.endDate ?? null,
    isActive: plan.isActive,
    // YYYY-MM-DD strings compare in calendar order.
    ended: !!plan.endDate && plan.endDate < today,
    workoutNames: listLiveWorkouts(plan.id, tx).map(w => w.name)
  }));
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

type PlanDates = Partial<Pick<PlanAttributes, "startDate" | "endDate">>;

// A Plan's From and To dates as a Change by AI words them.
function describeDates({ startDate, endDate }: PlanDates): string {
  if (startDate && endDate) {
    return `from ${startDate} to ${endDate}`;
  }

  if (startDate) {
    return `from ${startDate}`;
  }

  return endDate ? `until ${endDate}` : "with no dates";
}

const sameDates = (a: PlanDates, b: PlanDates) => (a.startDate ?? null) === (b.startDate ?? null) &&
  (a.endDate ?? null) === (b.endDate ?? null);

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
  }, plan => {
    const dated = plan.startDate !== null || plan.endDate !== null;

    return `Created Plan "${plan.name}"${dated ? ` to run ${describeDates(plan)}` : ""}`;
  });
}

export function updatePlan(
  id: string,
  payload: PlanUpdatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): PlanAttributes {
  const data = parseOrThrow(planUpdatePayloadSchema, payload);
  let was: PlanAttributes | undefined;

  return write(actor, tx, t => {
    was = getPlan(id, t);

    // A date left out of the edit keeps its saved value, so the order is
    // checked against what the Plan will hold.
    if (!isPlanDateOrder({
      ...was,
      ...data
    })) {
      throw new ApiError(400, PLAN_DATE_ORDER_MESSAGE, "ValidationError");
    }

    debug.info("updating plan %s", id);

    return updatePlanDb(id, data, t);
  }, plan => {
    const renamed = was?.name !== plan.name && `Renamed Plan "${was?.name}" to "${plan.name}"`;
    const redated = !sameDates(was ?? {}, plan) && `Set Plan "${plan.name}" to run ${describeDates(plan)}`;

    return [ renamed, redated ].filter(Boolean)
      .join("; ");
  });
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
