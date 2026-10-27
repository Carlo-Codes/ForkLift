import { z } from "zod";

import {
  planSchema, workoutCreatePayloadSchema, workoutUpdatePayloadSchema
} from "@forklift/db/client";
import type {
  PlanAttributes,
  TransactionType,
  WorkoutAttributes,
  WorkoutCreatePayload,
  WorkoutUpdatePayload
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { toCalendarDay } from "#utils/calendarDay";
import {
  DEFAULT_PLAN_WEEKS, planToDate, planWeeksSchema
} from "#utils/planWeeks";
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

// A new Plan's Workouts by how many it has, named after a common split
// (ADR-0007). They start empty and can be renamed.
const NEW_PLAN_WORKOUT_NAMES = [
  [ "Full Body" ],
  [ "Upper", "Lower" ],
  [
    "Push",
    "Pull",
    "Legs"
  ],
  [
    "Upper",
    "Lower",
    "Upper",
    "Lower"
  ],
  [
    "Push",
    "Pull",
    "Legs",
    "Upper",
    "Lower"
  ],
  [
    "Push",
    "Pull",
    "Legs",
    "Push",
    "Pull",
    "Legs"
  ]
] as const;

export const MAX_NEW_PLAN_WORKOUTS = NEW_PLAN_WORKOUT_NAMES.length;

// What the New plan form asks for: the Plan runs from startDate for weeks,
// cycling through workoutCount Workouts.
const newPlanPayloadSchema = planSchema.pick({ name: true }).extend({
  startDate: z.iso.date("Pick a start date"),
  weeks: planWeeksSchema,
  workoutCount: z.number().int("Workouts must be a whole number")
    .min(1, "A plan has at least 1 workout")
    .max(MAX_NEW_PLAN_WORKOUTS, `A new plan has at most ${MAX_NEW_PLAN_WORKOUTS} workouts`)
});

export type NewPlanPayload = z.infer<typeof newPlanPayloadSchema>;

// The New plan form as it opens: starting today, for 8 weeks, with 3 Workouts.
export function newPlanDefaults(now = new Date()): NewPlanPayload {
  return {
    name: "",
    startDate: toCalendarDay(now),
    weeks: DEFAULT_PLAN_WEEKS,
    workoutCount: 3
  };
}

// The Workouts a new Plan with workoutCount of them starts with; none for a
// count the form would reject.
export function newPlanWorkoutNames(workoutCount: number): readonly string[] {
  return NEW_PLAN_WORKOUT_NAMES[ workoutCount - 1 ] ?? [];
}

// A Plan as the lifter creates it with the New plan form: dated by its weeks
// (ADR-0006) and with its empty Workouts, all or nothing. It lives here rather
// than in planService, which workoutService already depends on. The AI's
// create_plan still makes an empty Plan.
export function createPlanWithWorkouts(payload: NewPlanPayload, tx?: TransactionType): PlanAttributes {
  const {
    name, startDate, weeks, workoutCount
  } = parseOrThrow(newPlanPayloadSchema, payload);

  return inTransaction(tx, t => {
    const plan = createPlan({
      name,
      startDate,
      endDate: planToDate(startDate, weeks)
    }, "lifter", t);

    for (const workoutName of newPlanWorkoutNames(workoutCount)) {
      createWorkout(plan.id, { name: workoutName }, "lifter", t);
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
