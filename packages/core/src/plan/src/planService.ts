import {
  PLAN_DATE_ORDER_MESSAGE, isPlanDateOrder, planCreatePayloadSchema, planUpdatePayloadSchema
} from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreatePayload,
  PlanUpdatePayload,
  SessionAttributes,
  TransactionType,
  WorkoutAttributes
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { toCalendarDay } from "#utils/calendarDay";
import {
  DEFAULT_PLAN_WEEKS, checkPlanLength, planToDate, planWeeks, planWeeksSchema
} from "#utils/planWeeks";
import { nextPosition } from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { refuseAi, write } from "#aiChange/aiChangeRecorder";
import { getAllWorkoutByQuery, getWorkoutByQuery } from "#workout/workoutDb";
import { getAllSessionByQuery } from "#session/sessionDb";

import {
  createPlanDb,
  deletePlanDb,
  getAllPlanByQuery,
  getPlanByQuery,
  updatePlanDb
} from "./planDb";
import { getPlanWeek } from "./planWeek";
import type { PlanWeek } from "./planWeek";

const debug = createDebugger("planService");

// Newest first.
export function listPlans(tx?: TransactionType): PlanAttributes[] {
  return getAllPlanByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

// A Plan as the Plans list shows it, with its progress. An Ended Plan keeps
// its place in the list (ADR-0006).
export type PlanListItem = Pick<PlanAttributes, "id" | "name" | "isActive"> & {
  startDate: string | null;
  endDate: string | null;
  progress: PlanProgress;
  workoutNames: string[];
};

// The Plans list, newest first. today is a YYYY-MM-DD calendar day.
export function listPlanCards(today = toCalendarDay(new Date()), tx?: TransactionType): PlanListItem[] {
  return listPlans(tx).map(plan => ({
    id: plan.id,
    name: plan.name,
    startDate: plan.startDate ?? null,
    endDate: plan.endDate ?? null,
    isActive: plan.isActive,
    progress: progressOf(plan, today, tx),
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

// How far through a Plan the lifter is: its Plan Week on the day (null with
// nothing to show), and how many Sessions of its Workouts they've finished.
// Never Sessions out of a planned total: the Plan is a rotation, not a
// schedule (ADR-0007).
export interface PlanProgress {
  planWeek: PlanWeek | null;
  sessionsDone: number;
}

// today is a YYYY-MM-DD calendar day. Sessions of Workouts deleted since still
// count: they're history and belong to the Plan.
export function getPlanProgress(
  id: string,
  today = toCalendarDay(new Date()),
  tx?: TransactionType
): PlanProgress {
  return progressOf(getPlan(id, tx), today, tx);
}

function progressOf(plan: PlanAttributes, today: string, tx?: TransactionType): PlanProgress {
  return {
    planWeek: getPlanWeek(plan, today),
    sessionsDone: countFinishedSessions(plan.id, tx)
  };
}

function countFinishedSessions(planId: string, tx?: TransactionType): number {
  return listFinishedPlanSessions(planId, tx).length;
}

// The live, finished Sessions of the Plan's Workouts, newest first, each with
// its Workout. Workouts deleted since are included: their Sessions are history
// and belong to the Plan.
export function listFinishedPlanSessions(
  planId: string,
  tx?: TransactionType
): { session: SessionAttributes; workout: WorkoutAttributes }[] {
  const workouts = new Map(getAllWorkoutByQuery({ where: { planId } }, tx).map(w => [ w.id, w ]));

  if (workouts.size === 0) {
    return [];
  }

  return getAllSessionByQuery({
    where: {
      workoutId: { in: [ ...workouts.keys() ] },
      status: "finished",
      deletedAt: { isNull: true }
    }
  }, tx).map(session => ({
    session,
    workout: workouts.get(session.workoutId)!
  }));
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

  checkPlanLength(data);

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

    // A date left out of the edit keeps its saved value, so the order and
    // length are checked against what the Plan will hold. A Plan saved longer
    // than MAX_PLAN_WEEKS before the cap can still be renamed.
    const dates = {
      ...was,
      ...data
    };

    if (!isPlanDateOrder(dates)) {
      throw new ApiError(400, PLAN_DATE_ORDER_MESSAGE, "ValidationError");
    }

    if (data.startDate !== undefined || data.endDate !== undefined) {
      checkPlanLength(dates);
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

// The Plan editor's date row: a Plan's start date and the weeks it lasts, still
// stored as From and To (ADR-0006). A To that isn't a whole number of weeks
// after From (set by the AI, or before the row counted weeks) reads rounded
// up. weeks is null unless both dates are set; endDate is kept for a Plan the
// AI gave only a To.
export interface PlanDateRow {
  startDate: string | null;
  weeks: number | null;
  endDate: string | null;
}

export function planDateRow({ startDate, endDate }: PlanDates): PlanDateRow {
  return {
    startDate: startDate ?? null,
    weeks: startDate && endDate ? planWeeks(startDate, endDate) : null,
    endDate: endDate ?? null
  };
}

// A new start date keeps the Plan's weeks (or gives it the default length when
// it has none) and moves To with it; null clears both dates. Saved as a From/To
// edit, so AI Access sees From and To as ever. The lifter's only: the AI sets
// From and To.
export function setPlanStart(id: string, day: string | null, tx?: TransactionType): PlanAttributes {
  // Checked before To is counted from it.
  const { startDate } = parseOrThrow(planUpdatePayloadSchema, { startDate: day });

  return inTransaction(tx, t => {
    if (!startDate) {
      return updatePlan(id, {
        startDate: null,
        endDate: null
      }, "lifter", t);
    }

    const weeks = planDateRow(getPlan(id, t)).weeks ?? DEFAULT_PLAN_WEEKS;

    return updatePlan(id, {
      startDate,
      endDate: planToDate(startDate, weeks)
    }, "lifter", t);
  });
}

// A new length in weeks moves To; the start date stays. A Plan needs a start
// date to count weeks from.
export function setPlanWeeks(id: string, weeks: number, tx?: TransactionType): PlanAttributes {
  const valid = parseOrThrow(planWeeksSchema, weeks);

  return inTransaction(tx, t => {
    const { startDate } = getPlan(id, t);

    if (!startDate) {
      throw new ApiError(400, "Pick a start date first", "ValidationError");
    }

    return updatePlan(id, { endDate: planToDate(startDate, valid) }, "lifter", t);
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
