import {
  afterEach, beforeEach, describe, expect, it
} from "@jest/globals";

import {
  createBlock,
  createExercise,
  createPlan,
  createWorkout,
  deleteWorkout,
  groupBlocks,
  setActivePlan,
  startSession
} from "@forklift/core";
import { setupTestDb } from "@forklift/db/server";

import { formatEntrySummary } from "../format";
import { loadHomeCard } from "../home";

describe("formatEntrySummary", () => {
  const entry = (exerciseName: string, targetSets: number, targetReps: number) => ({
    exerciseName,
    targetSets,
    targetReps
  });

  it("lists each Exercise Entry with its sets and reps", () => {
    expect(formatEntrySummary([ entry("Bench Press", 3, 8), entry("Row", 3, 10) ]))
      .toBe("Bench Press 3×8 · Row 3×10");
  });

  it("cuts a long list short with an ellipsis", () => {
    expect(formatEntrySummary([
      entry("A", 1, 1),
      entry("B", 2, 2),
      entry("C", 3, 3),
      entry("D", 4, 4),
      entry("E", 5, 5)
    ], 3)).toBe("A 1×1 · B 2×2 · C 3×3 · …");
  });

  it("is empty with no Exercise Entries", () => {
    expect(formatEntrySummary([])).toBe("");
  });
});

describe("loadHomeCard", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => {
    teardown();
  });

  const seedPlan = () => {
    const plan = createPlan({ name: "PPL" });
    const push = createWorkout(plan.id, { name: "Push" });
    const bench = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    });
    const fly = createExercise({
      name: "Cable Fly",
      muscleGroups: [ "chest" ]
    });
    const dip = createExercise({
      name: "Dip",
      muscleGroups: [ "chest" ]
    });

    createBlock(push.id, {
      exerciseId: bench.id,
      targetSets: 3,
      targetReps: 8
    });
    const a = createBlock(push.id, {
      exerciseId: fly.id,
      targetSets: 3,
      targetReps: 12
    });
    const b = createBlock(push.id, {
      exerciseId: dip.id,
      targetSets: 2,
      targetReps: 10
    });

    groupBlocks(push.id, [ a.id, b.id ]);

    return {
      plan,
      push
    };
  };

  it("asks for a Plan when none is Active", () => {
    createPlan({ name: "Unused" });

    expect(loadHomeCard()).toEqual({ kind: "noPlan" });
  });

  it("points at the Active Plan when it has no Workouts", () => {
    const plan = createPlan({ name: "Empty" });

    setActivePlan(plan.id);

    expect(loadHomeCard()).toEqual({
      kind: "emptyPlan",
      planId: plan.id,
      planName: "Empty"
    });
  });

  it("offers the next Workout with its Plan and Exercise Entries, Superset ones included", () => {
    const { plan, push } = seedPlan();

    setActivePlan(plan.id);

    expect(loadHomeCard()).toEqual({
      kind: "next",
      workoutId: push.id,
      workoutName: "Push",
      planName: "PPL",
      entries: "Bench Press 3×8 · Cable Fly 3×12 · Dip 2×10"
    });
  });

  it("offers to Resume a Session in progress, as it was snapshotted at Start", () => {
    const { plan, push } = seedPlan();

    setActivePlan(plan.id);
    const session = startSession(push.id);

    // Edits after Start don't change the Session, and nor does losing the Workout.
    setActivePlan(null);
    deleteWorkout(push.id);

    expect(loadHomeCard()).toEqual({
      kind: "resume",
      sessionId: session.id,
      workoutName: "Push",
      planName: "PPL",
      entries: "Bench Press 3×8 · Cable Fly 3×12 · Dip 2×10"
    });
  });
});
