import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createPlan, deletePlan, getPlanProgress
} from "..";
import { createExercise } from "#exercise";
import { createBlock } from "#block";
import { createWorkout, deleteWorkout } from "#workout";
import { finishSession, startSession } from "#session";
import { updateSessionDb } from "#session/sessionDb";

describe("getPlanProgress", () => {
  let teardown: () => void;
  let benchId: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    }));
  });

  afterEach(() => teardown());

  // A Workout of the Plan with one Exercise Entry, ready to Start.
  const addWorkout = (planId: string, name: string) => {
    const workout = createWorkout(planId, { name });

    createBlock(workout.id, {
      exerciseId: benchId,
      targetSets: 3,
      targetReps: 8
    });

    return workout;
  };

  const finish = (workoutId: string) => finishSession(startSession(workoutId).id);

  it("reads the Plan Week and the Sessions finished in the Plan", () => {
    const plan = createPlan({
      name: "PPL",
      startDate: "2026-11-02",
      endDate: "2026-12-13"
    });
    const push = addWorkout(plan.id, "Push");
    const pull = addWorkout(plan.id, "Pull");

    finish(push.id);
    finish(pull.id);
    finish(push.id);

    expect(getPlanProgress(plan.id, "2026-11-18")).toEqual({
      planWeek: {
        status: "running",
        week: 3,
        totalWeeks: 6
      },
      sessionsDone: 3
    });
  });

  it("counts only finished, live Sessions of this Plan's Workouts, deleted Workouts included", () => {
    const plan = createPlan({ name: "PPL" });
    const other = createPlan({ name: "Other" });
    const push = addWorkout(plan.id, "Push");
    const legs = addWorkout(plan.id, "Legs");

    finish(addWorkout(other.id, "Elsewhere").id);
    finish(legs.id);
    deleteWorkout(legs.id);
    updateSessionDb(finish(push.id).id, { deletedAt: new Date() });
    finish(push.id);
    startSession(push.id);

    expect(getPlanProgress(plan.id, "2026-11-18")).toEqual({
      planWeek: null,
      sessionsDone: 2
    });
  });

  it("reads before the start and after the end", () => {
    const plan = createPlan({
      name: "Block",
      startDate: "2026-11-02",
      endDate: "2026-12-13"
    });

    expect([ "2026-10-28", "2026-12-14" ].map(today => getPlanProgress(plan.id, today).planWeek)).toEqual([
      {
        status: "upcoming",
        daysUntilStart: 5,
        totalWeeks: 6
      },
      {
        status: "ended",
        totalWeeks: 6
      }
    ]);
  });

  it("refuses a deleted Plan", () => {
    const plan = createPlan({ name: "Gone" });

    deletePlan(plan.id);

    expect(() => getPlanProgress(plan.id, "2026-11-18")).toThrow(expect.objectContaining({ statusCode: 404 }) as ApiError);
  });
});
