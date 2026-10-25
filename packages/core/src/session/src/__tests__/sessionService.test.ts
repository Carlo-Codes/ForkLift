import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  completeSet, finishSession, getCurrentStep, getSession, startSession
} from "..";
import { createExercise } from "../../../exercise/src";
import {
  createPlan, getNextWorkout, setActivePlan
} from "../../../plan/src";
import { updateExerciseEntry } from "../../../plan/workout/block/exerciseEntry/src";
import { createBlock, deleteBlock } from "../../../plan/workout/block/src";
import {
  createWorkout, deleteWorkout, reorderWorkouts
} from "../../../plan/workout/src";
import { setUnit } from "../../../setting/src";
import { listLoggedSets } from "../../loggedSet/src";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const conflictError = expect.objectContaining({
  statusCode: 409,
  type: "ConflictError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("sessions", () => {
  let teardown: () => void;
  let planId: string;
  let pushId: string;
  let benchId: string;
  let flyId: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: planId } = createPlan({ name: "PPL" }));
    ({ id: pushId } = createWorkout(planId, { name: "Push" }));
    ({ id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    }));
    ({ id: flyId } = createExercise({
      name: "Cable Fly",
      muscleGroups: [ "chest" ]
    }));
  });

  afterEach(() => teardown());

  it("starts on the first set of the first Block, showing its target and the set after it", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 3,
      targetReps: 5,
      targetWeight: 80
    });

    const session = startSession(pushId);
    const step = getCurrentStep(session.id);

    expect(step.current).toEqual(expect.objectContaining({
      exerciseName: "Bench Press",
      setNumber: 1,
      totalSets: 3,
      targetReps: 5,
      targetWeight: 80
    }));
    expect(step.next).toEqual(expect.objectContaining({
      exerciseName: "Bench Press",
      setNumber: 2
    }));
    expect(step.rest).toBeUndefined();
  });

  it("logs Done as planned and moves to the next set", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      targetReps: 5,
      targetWeight: 80
    });

    const { id } = startSession(pushId);
    const step = completeSet(id);

    expect(listLoggedSets(id)).toEqual([
      expect.objectContaining({
        exerciseId: benchId,
        round: 1,
        reps: 5,
        weight: 80,
        completedAt: expect.any(Date) as unknown
      })
    ]);
    expect(step.current).toEqual(expect.objectContaining({ setNumber: 2 }));
    expect(step.next).toBeUndefined();
  });

  it("records the reps and weight actually done", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      targetReps: 5,
      targetWeight: 80
    });

    const { id } = startSession(pushId);

    completeSet(id, { reps: 4 });
    completeSet(id, {
      reps: 6,
      weight: 77.5
    });

    expect(listLoggedSets(id).map(s => [ s.reps, s.weight ])).toEqual([ [ 4, 80 ], [ 6, 77.5 ] ]);
  });

  it("rejects impossible numbers and logs nothing", () => {
    createBlock(pushId, { exerciseId: benchId });

    const { id } = startSession(pushId);

    expect(() => completeSet(id, { reps: -1 })).toThrow(validationError);
    expect(() => completeSet(id, { weight: Number.NaN })).toThrow(validationError);
    expect(listLoggedSets(id)).toEqual([]);
  });

  it("runs straight sets Block by Block, then reports every set done", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2
    });
    createBlock(pushId, {
      exerciseId: flyId,
      targetSets: 1
    });

    const { id } = startSession(pushId);
    const seen: string[] = [];

    for (let step = getCurrentStep(id); step.current; step = completeSet(id)) {
      seen.push(`${step.current.exerciseName} ${step.current.setNumber}/${step.current.totalSets}`);
    }

    expect(seen).toEqual([ "Bench Press 1/2", "Bench Press 2/2", "Cable Fly 1/1" ]);
    expect(getCurrentStep(id)).toEqual(expect.objectContaining({
      current: undefined,
      next: undefined
    }));
    expect(() => completeSet(id)).toThrow(conflictError);
  });

  it("rests after each set for the entry's rest time, but not after the last set", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 1,
      restSeconds: 180
    });
    createBlock(pushId, {
      exerciseId: flyId,
      targetSets: 1,
      restSeconds: 60
    });

    const { id } = startSession(pushId);
    const afterBench = completeSet(id);
    const [ bench ] = listLoggedSets(id);

    expect(afterBench.rest).toEqual({
      seconds: 180,
      endsAt: new Date(bench!.completedAt.getTime() + 180_000)
    });
    expect(completeSet(id).rest).toBeUndefined();
  });

  it("skips rest for an entry with no rest time", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      restSeconds: 0
    });

    const { id } = startSession(pushId);

    expect(completeSet(id).rest).toBeUndefined();
  });

  it("keeps the targets from Start when the Workout is edited mid-Session", () => {
    const bench = createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      targetReps: 5,
      targetWeight: 80
    });
    const fly = createBlock(pushId, { exerciseId: flyId });
    const { id } = startSession(pushId);

    updateExerciseEntry(bench.exerciseEntries[ 0 ]!.id, {
      targetSets: 5,
      targetWeight: 100
    });
    deleteBlock(fly.id);
    createBlock(pushId, { exerciseId: flyId });

    const step = completeSet(id);

    expect(step.current).toEqual(expect.objectContaining({
      setNumber: 2,
      totalSets: 2,
      targetWeight: 80
    }));
    expect(step.next).toEqual(expect.objectContaining({ exerciseId: flyId }));
    expect(listLoggedSets(id)[ 0 ]?.weight).toBe(80);

    // The edits apply from the next Session.
    expect(getCurrentStep(startSession(pushId).id).current).toEqual(expect.objectContaining({
      totalSets: 5,
      targetWeight: 100
    }));
  });

  it("won't start a Workout with no exercises, or one that's deleted", () => {
    expect(() => startSession(pushId)).toThrow(validationError);

    createBlock(pushId, { exerciseId: benchId });
    deleteWorkout(pushId);

    expect(() => startSession(pushId)).toThrow(notFoundError);
  });

  it("converts logged weights and the running Session's targets when the unit changes", () => {
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      targetWeight: 100
    });

    const { id } = startSession(pushId);

    completeSet(id, { weight: 80 });
    setUnit("lb");

    expect(listLoggedSets(id)[ 0 ]?.weight).toBe(176.4);
    expect(getCurrentStep(id).current?.targetWeight).toBe(220.5);
  });

  describe("finishing and the rotation", () => {
    let pullId: string;
    let legsId: string;

    // Each Workout gets one set, so a Session is quick to run.
    const runSession = (workoutId: string) => {
      const { id } = startSession(workoutId);

      completeSet(id);
      finishSession(id);

      return id;
    };

    beforeEach(() => {
      ({ id: pullId } = createWorkout(planId, { name: "Pull" }));
      ({ id: legsId } = createWorkout(planId, { name: "Legs" }));

      for (const workoutId of [ pushId, pullId, legsId ]) {
        createBlock(workoutId, {
          exerciseId: benchId,
          targetSets: 1
        });
      }
    });

    it("offers nothing until a Plan is Active, then its first Workout", () => {
      expect(getNextWorkout()).toBeUndefined();

      setActivePlan(planId);

      expect(getNextWorkout()?.id).toBe(pushId);
    });

    it("marks the Session finished, after which it takes no more sets", () => {
      const { id } = startSession(pushId);

      finishSession(id);

      expect(getSession(id)).toEqual(expect.objectContaining({
        status: "finished",
        finishedAt: expect.any(Date) as unknown
      }));
      expect(() => completeSet(id)).toThrow(conflictError);
      expect(() => finishSession(id)).toThrow(conflictError);
    });

    it("advances Push → Pull → Legs and back to Push as Sessions finish", () => {
      setActivePlan(planId);

      const offered = [ getNextWorkout()?.name ];

      for (let i = 0; i < 3; i++) {
        runSession(getNextWorkout()!.id);
        offered.push(getNextWorkout()?.name);
      }

      expect(offered).toEqual([ "Push", "Pull", "Legs", "Push" ]);
    });

    it("carries on after the Workout the lifter chose instead", () => {
      setActivePlan(planId);
      runSession(pullId);

      expect(getNextWorkout()?.id).toBe(legsId);
    });

    it("doesn't advance for a Session that's started but not finished", () => {
      setActivePlan(planId);
      completeSet(startSession(pushId).id);

      expect(getNextWorkout()?.id).toBe(pushId);
    });

    it("follows the Workouts' current order and falls back to the first when the next is deleted", () => {
      setActivePlan(planId);
      runSession(pushId);
      reorderWorkouts(planId, [ legsId, pushId, pullId ]);

      expect(getNextWorkout()?.id).toBe(pullId);

      deleteWorkout(pullId);

      expect(getNextWorkout()?.id).toBe(legsId);
    });
  });
});
