import { jest } from "@jest/globals";
import { setupTestDb } from "@forklift/db/server";

import type { ApiError } from "@forklift/debug";

import {
  getExerciseHistory, getSessionDetail, listSessionHistory
} from "..";
import {
  createExercise, deleteExercise, updateExercise
} from "#exercise";
import { createPlan, deletePlan } from "#plan";
import { updateExerciseEntry } from "#exerciseEntry";
import {
  createBlock, groupBlocks, listBlocks
} from "#block";
import {
  createWorkout, deleteWorkout, updateWorkout
} from "#workout";
import {
  completeSet, finishSession, getCurrentStep, startSession
} from "#session";

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("history", () => {
  let teardown: () => void;
  let planId: string;
  let pushId: string;
  let pullId: string;
  let benchId: string;
  let rowId: string;

  // Each Session runs on its own day, so the order never leans on the clock.
  let day = 0;

  const onNextDay = () => {
    day += 1;
    jest.setSystemTime(new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00Z`));
  };

  // Runs a Session of the Workout, logging each set as given (reps, or [reps, weight]),
  // then finishes it; sets not given are left for the finish to record as skipped.
  const runSession = (workoutId: string, sets: (number | [number, number])[] = []) => {
    onNextDay();

    const { id } = startSession(workoutId);

    for (const set of sets) {
      completeSet(id, Array.isArray(set) ? {
        reps: set[ 0 ],
        weight: set[ 1 ]
      } : { reps: set });
    }

    finishSession(id);

    return id;
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-09-30T09:00:00Z") });
    day = 0;
    ({ teardown } = setupTestDb());
    ({ id: planId } = createPlan({ name: "PPL" }));
    ({ id: pushId } = createWorkout(planId, { name: "Push" }));
    ({ id: pullId } = createWorkout(planId, { name: "Pull" }));
    ({ id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    }));
    ({ id: rowId } = createExercise({
      name: "Row",
      muscleGroups: [ "back" ]
    }));
    createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 3,
      targetReps: 8,
      targetWeight: 57.5
    });
    createBlock(pullId, {
      exerciseId: rowId,
      targetSets: 2,
      targetReps: 10,
      targetWeight: 50
    });
  });

  afterEach(() => {
    teardown();
    jest.useRealTimers();
  });

  it("lists finished Sessions newest first with their date and Workout name, leaving out one in progress", () => {
    const first = runSession(pushId, [ 8 ]);
    const second = runSession(pullId);

    onNextDay();
    startSession(pushId);

    expect(listSessionHistory().map(s => [ s.id, s.workoutName, s.startedAt.toISOString() ])).toEqual([
      [ second, "Pull", "2026-10-02T09:00:00.000Z" ],
      [ first, "Push", "2026-10-01T09:00:00.000Z" ]
    ]);
  });

  describe("between two dates", () => {
    const validationError = expect.objectContaining({
      statusCode: 400,
      type: "ValidationError"
    }) as ApiError;

    let sessionIds: string[];

    beforeEach(() => {
      // 1, 2, 3 and 4 October.
      sessionIds = [
        runSession(pushId, [ 8 ]),
        runSession(pullId),
        runSession(pushId, [ [ 8, 60 ] ]),
        runSession(pullId)
      ];
    });

    it("lists the Sessions started in the range, both days included", () => {
      expect(listSessionHistory({
        from: "2026-10-02",
        to: "2026-10-03"
      }).map(s => s.id)).toEqual([ sessionIds[ 2 ], sessionIds[ 1 ] ]);
    });

    it("takes a range open at either end, and exact times", () => {
      expect(listSessionHistory({ from: "2026-10-03T09:00:00Z" }).map(s => s.id))
        .toEqual([ sessionIds[ 3 ], sessionIds[ 2 ] ]);
      expect(listSessionHistory({ to: new Date("2026-10-01T09:00:00Z") }).map(s => s.id))
        .toEqual([ sessionIds[ 0 ] ]);
    });

    it("lists nothing for a range with no Sessions", () => {
      expect(listSessionHistory({ from: "2026-11-01" })).toEqual([]);
    });

    it("rejects a range that ends before it starts, or isn't a date", () => {
      expect(() => listSessionHistory({
        from: "2026-10-03",
        to: "2026-10-02"
      })).toThrow(validationError);
      expect(() => listSessionHistory({ from: "last week" })).toThrow(validationError);
    });

    it("narrows an Exercise's history and its best set to the range", () => {
      const { sessions, bestSet } = getExerciseHistory(benchId, { to: "2026-10-02" });

      expect(sessions.map(s => s.id)).toEqual([ sessionIds[ 0 ] ]);
      expect(bestSet).toEqual(expect.objectContaining({
        weight: 57.5,
        reps: 8
      }));
    });
  });

  it("shows every Logged Set of a Session by Block and Exercise Entry, skipped sets marked", () => {
    const curlId = createExercise({
      name: "Curl",
      muscleGroups: [ "biceps" ]
    }).id;

    groupBlocks(pullId, [
      createBlock(pullId, {
        exerciseId: rowId,
        targetSets: 1,
        targetReps: 12,
        targetWeight: 40
      }).id,
      createBlock(pullId, {
        exerciseId: curlId,
        targetSets: 1,
        targetReps: 12,
        targetWeight: 12
      }).id
    ]);

    // Row 10 @ 50, Row 9 @ 50, then the Superset: Row 12 @ 40 done, Curl skipped.
    const id = runSession(pullId, [ 10, [ 9, 50 ], 12 ]);
    const detail = getSessionDetail(id);
    const sets = (entry: (typeof detail.blocks)[number][number]) =>
      entry.sets.map(s => [ s.round, s.reps, s.weight, s.skipped ]);

    expect(detail).toEqual(expect.objectContaining({
      id,
      workoutName: "Pull",
      startedAt: new Date("2026-10-01T09:00:00Z")
    }));
    expect(detail.blocks.map(entries => entries.map(e => e.exerciseName))).toEqual([ [ "Row" ], [ "Row", "Curl" ] ]);
    expect(sets(detail.blocks[ 0 ]![ 0 ]!)).toEqual([ [ 1, 10, 50, false ], [ 2, 9, 50, false ] ]);
    expect(sets(detail.blocks[ 1 ]![ 0 ]!)).toEqual([ [ 1, 12, 40, false ] ]);
    expect(sets(detail.blocks[ 1 ]![ 1 ]!)).toEqual([ [ 1, 0, 0, true ] ]);
  });

  it("won't show a Session that doesn't exist", () => {
    expect(() => getSessionDetail(crypto.randomUUID())).toThrow(notFoundError);
  });

  describe("an Exercise's history", () => {
    // Each Session's sets of the Exercise as "weight×reps".
    const history = (exerciseId: string) => getExerciseHistory(exerciseId).sessions
      .map(s => s.sets.map(set => `${set.weight}×${set.reps}`));

    it("lists the sets done in each Session that used it, newest first, leaving out skipped sets and other Exercises", () => {
      runSession(pushId, [ 8, 8, 7 ]);
      runSession(pullId, [ 10, 10 ]);
      runSession(pushId, [ [ 8, 60 ] ]);

      const { exercise, sessions } = getExerciseHistory(benchId);

      expect(exercise.name).toBe("Bench Press");
      expect(sessions.map(s => [ s.workoutName, s.startedAt.toISOString() ])).toEqual([
        [ "Push", "2026-10-03T09:00:00.000Z" ],
        [ "Push", "2026-10-01T09:00:00.000Z" ]
      ]);
      expect(history(benchId)).toEqual([ [ "60×8" ], [ "57.5×8", "57.5×8", "57.5×7" ] ]);
    });

    it("picks the heaviest set as the best, more reps breaking a tie, per Session and overall", () => {
      runSession(pushId, [ 8, [ 6, 62.5 ], [ 7, 62.5 ] ]);
      runSession(pushId, [ [ 5, 65 ], [ 12, 50 ] ]);
      runSession(pushId, [ [ 10, 60 ] ]);

      const { sessions, bestSet } = getExerciseHistory(benchId);

      expect(sessions.map(s => s.bestSet && `${s.bestSet.weight}×${s.bestSet.reps}`)).toEqual([ "60×10", "65×5", "62.5×7" ]);
      expect(bestSet).toEqual(expect.objectContaining({
        weight: 65,
        reps: 5
      }));
    });

    it("leaves out a Session whose sets of it were all skipped, with no best set", () => {
      runSession(pushId);

      const { sessions, bestSet } = getExerciseHistory(benchId);

      expect(sessions).toEqual([]);
      expect(bestSet).toBeUndefined();
    });

    it("won't show an Exercise that never existed", () => {
      expect(() => getExerciseHistory(crypto.randomUUID())).toThrow(notFoundError);
    });
  });

  describe("last time", () => {
    // What Workout Mode shows as "Last time" on the current set, as "weight×reps".
    const lastTime = (sessionId: string) => getCurrentStep(sessionId).lastTime?.sets
      .map(set => `${set.weight}×${set.reps}`);

    it("has nothing for an Exercise Entry's first Session", () => {
      const { id } = startSession(pushId);

      expect(getCurrentStep(id).lastTime).toBeUndefined();
    });

    it("shows the sets done in the entry's last finished Session, including one finished early", () => {
      runSession(pushId, [ 8, 8, 7 ]);
      runSession(pushId, [ [ 8, 60 ] ]);
      onNextDay();

      const { id } = startSession(pushId);

      expect(lastTime(id)).toEqual([ "60×8" ]);
      expect(getCurrentStep(id).lastTime?.startedAt).toEqual(new Date("2026-10-02T09:00:00Z"));

      completeSet(id);

      expect(lastTime(id)).toEqual([ "60×8" ]);
    });

    it("passes over a Session where the entry was skipped", () => {
      runSession(pushId, [ 8, 8, 7 ]);
      runSession(pushId);
      onNextDay();

      expect(lastTime(startSession(pushId).id)).toEqual([ "57.5×8", "57.5×8", "57.5×7" ]);
    });

    it("follows the current set's entry, so each exercise of a Superset has its own", () => {
      const { id: curlId } = createExercise({
        name: "Curl",
        muscleGroups: [ "biceps" ]
      });

      groupBlocks(pullId, [
        listBlocks(pullId)[ 0 ]!.id,
        createBlock(pullId, {
          exerciseId: curlId,
          targetSets: 2,
          targetReps: 12,
          targetWeight: 12
        }).id
      ]);
      // Row, Curl, Row, Curl.
      runSession(pullId, [ 10, 12, 9, 11 ]);
      onNextDay();

      const { id } = startSession(pullId);

      expect(lastTime(id)).toEqual([ "50×10", "50×9" ]);

      completeSet(id);

      expect(lastTime(id)).toEqual([ "12×12", "12×11" ]);
    });
  });

  describe("after edits and deletes", () => {
    it("keeps showing a Session whose Workout, Plan and Exercise were deleted", () => {
      const id = runSession(pushId, [ 8, 8, 7 ]);

      deleteExercise(benchId);
      deleteWorkout(pushId);
      deletePlan(planId);

      expect(listSessionHistory().map(s => s.workoutName)).toEqual([ "Push" ]);
      expect(getSessionDetail(id).blocks[ 0 ]![ 0 ]).toEqual(expect.objectContaining({
        exerciseName: "Bench Press",
        sets: [
          expect.objectContaining({ reps: 8 }),
          expect.objectContaining({ reps: 8 }),
          expect.objectContaining({ reps: 7 })
        ] as unknown
      }));

      const { exercise, sessions } = getExerciseHistory(benchId);

      expect(exercise.name).toBe("Bench Press");
      expect(sessions.map(s => [ s.workoutName, s.sets.length ])).toEqual([ [ "Push", 3 ] ]);
    });

    it("starts last time afresh when the entry is switched to another Exercise", () => {
      runSession(pushId, [ 8, 8, 7 ]);
      updateExerciseEntry(listBlocks(pushId)[ 0 ]!.exerciseEntries[ 0 ]!.id, { exerciseId: rowId });
      onNextDay();

      expect(getCurrentStep(startSession(pushId).id).lastTime).toBeUndefined();
    });

    it("keeps last time once the Exercise is deleted from the Library", () => {
      runSession(pushId, [ 8, 8, 7 ]);
      deleteExercise(benchId);
      onNextDay();

      expect(getCurrentStep(startSession(pushId).id).lastTime?.sets.map(s => s.reps)).toEqual([ 8, 8, 7 ]);
    });

    it("names a Session's Exercise as it was then, and the Exercise's history by its name now", () => {
      const id = runSession(pushId, [ 8 ]);

      updateExercise(benchId, { name: "Flat Bench" });
      updateWorkout(pushId, { name: "Push A" });

      expect(getSessionDetail(id).blocks[ 0 ]![ 0 ]!.exerciseName).toBe("Bench Press");
      expect(getExerciseHistory(benchId).exercise.name).toBe("Flat Bench");
      expect(listSessionHistory()[ 0 ]!.workoutName).toBe("Push A");
    });
  });
});
