import { setupTestDb } from "@forklift/db/server";

import { getHomeCard } from "..";
import { createExercise } from "#exercise";
import { createPlan, setActivePlan } from "#plan";
import { createBlock, groupBlocks } from "#block";
import { createWorkout, deleteWorkout } from "#workout";
import { startSession } from "#session";

describe("getHomeCard", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => {
    teardown();
  });

  const pushEntries = [
    {
      exerciseName: "Bench Press",
      targetSets: 3,
      targetReps: 8
    },
    {
      exerciseName: "Cable Fly",
      targetSets: 3,
      targetReps: 12
    },
    {
      exerciseName: "Dip",
      targetSets: 2,
      targetReps: 10
    }
  ];

  // A Plan with a Push Workout: Bench Press, then a Superset of Cable Fly and Dip.
  const seedPlan = () => {
    const plan = createPlan({ name: "PPL" });
    const push = createWorkout(plan.id, { name: "Push" });
    const [ bench, fly, dip ] = pushEntries.map(({ exerciseName, targetSets, targetReps }) => ({
      exercise: createExercise({
        name: exerciseName,
        muscleGroups: [ "chest" ]
      }),
      targetSets,
      targetReps
    }));
    const add = (entry: typeof bench) => createBlock(push.id, {
      exerciseId: entry!.exercise.id,
      targetSets: entry!.targetSets,
      targetReps: entry!.targetReps
    });

    add(bench);
    groupBlocks(push.id, [ add(fly).id, add(dip).id ]);

    return {
      plan,
      push
    };
  };

  it("asks for a Plan when none is Active", () => {
    createPlan({ name: "Unused" });

    expect(getHomeCard()).toEqual({ kind: "noPlan" });
  });

  it("points at the Active Plan when it has no Workouts", () => {
    const plan = createPlan({ name: "Empty" });

    setActivePlan(plan.id);

    expect(getHomeCard()).toEqual({
      kind: "emptyPlan",
      planId: plan.id,
      planName: "Empty"
    });
  });

  it("offers the next Workout with its Plan and Exercise Entries, Superset ones included", () => {
    const { plan, push } = seedPlan();

    setActivePlan(plan.id);

    expect(getHomeCard()).toEqual({
      kind: "next",
      workoutId: push.id,
      workoutName: "Push",
      planName: "PPL",
      entries: pushEntries
    });
  });

  it("offers to Resume a Session in progress, as snapshotted at Start", () => {
    const { plan, push } = seedPlan();

    setActivePlan(plan.id);
    const session = startSession(push.id);

    // Neither a change of Active Plan nor deleting the Workout loses it.
    setActivePlan(null);
    deleteWorkout(push.id);

    expect(getHomeCard()).toEqual({
      kind: "resume",
      sessionId: session.id,
      workoutName: "Push",
      planName: "PPL",
      entries: pushEntries
    });
  });
});
