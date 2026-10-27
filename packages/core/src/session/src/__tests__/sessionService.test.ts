import { jest } from "@jest/globals";
import { setupTestDb } from "@forklift/db/server";
import type { ExerciseEntryCreatePayload } from "@forklift/db/client";
import type { ApiError } from "@forklift/debug";

import {
  completeSet, finishSession, getCurrentStep, getSession, resumeSession, setIncrease, skipExercise, skipRest, skipSet, startSession
} from "..";
import { createExercise } from "#exercise";
import {
  createPlan, getNextWorkout, setActivePlan
} from "#plan";
import { getExerciseEntry, updateExerciseEntry } from "#exerciseEntry";
import {
  createBlock, deleteBlock, groupBlocks
} from "#block";
import {
  createWorkout, deleteWorkout, reorderWorkouts
} from "#workout";
import { setUnit } from "#setting";
import { listLoggedSets } from "#loggedSet";

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
  let reopen: () => void;
  let planId: string;
  let pushId: string;
  let benchId: string;
  let flyId: string;

  beforeEach(() => {
    ({ reopen, teardown } = setupTestDb());
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
      endsAt: new Date(bench!.completedAt.getTime() + 180_000),
      changeover: true
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
    finishSession(id);

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

  describe("Supersets", () => {
    let rowId: string;
    let curlId: string;

    // Runs the whole Session, noting each set as "<exercise> <set>" with the
    // Superset position when there is one, and "rest <seconds>" where rest is due,
    // or "changeover <seconds>" where that rest is a Changeover.
    const runAll = (sessionId: string) => {
      const seen: string[] = [];

      for (let step = getCurrentStep(sessionId); step.current; step = completeSet(sessionId)) {
        const { exerciseName, setNumber, superset } = step.current;

        if (step.rest) {
          seen.push(`${step.rest.changeover ? "changeover" : "rest"} ${step.rest.seconds}`);
        }

        seen.push(superset ?
          `${exerciseName} ${superset.letter}${setNumber} ${superset.position}/${superset.roundSize}` :
          `${exerciseName} ${setNumber}`);
      }

      return seen;
    };

    // Adds one single-entry Block per entry and groups them into a Superset.
    const createSuperset = (...entries: ExerciseEntryCreatePayload[]) => groupBlocks(
      pushId,
      entries.map(entry => createBlock(pushId, entry).id)
    );

    // A frozen clock logs every set in the same millisecond, as a quick lifter
    // (or a test) can, so ordering never leans on completedAt.
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date("2026-10-25T09:00:00Z") });
      ({ id: rowId } = createExercise({
        name: "Row",
        muscleGroups: [ "back" ]
      }));
      ({ id: curlId } = createExercise({
        name: "Curl",
        muscleGroups: [ "biceps" ]
      }));
    });

    afterEach(() => jest.useRealTimers());

    it("alternates the entries in rounds when their set counts are equal", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 2,
        restSeconds: 0
      }, {
        exerciseId: rowId,
        targetSets: 2,
        restSeconds: 0
      });

      expect(runAll(startSession(pushId).id)).toEqual([
        "Bench Press A1 1/2",
        "Row B1 2/2",
        "Bench Press A2 1/2",
        "Row B2 2/2"
      ]);
    });

    it("carries on with the other entries, resting after each of their rounds, when one is skipped", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 3,
        restSeconds: 60
      }, {
        exerciseId: rowId,
        targetSets: 3,
        restSeconds: 60
      });

      const { id } = startSession(pushId);

      completeSet(id);
      completeSet(id);
      completeSet(id);

      expect(skipExercise(id).current).toEqual(expect.objectContaining({
        exerciseName: "Bench Press",
        setNumber: 3
      }));
      expect(listLoggedSets(id).filter(s => s.skipped)
        .map(s => [ s.exerciseId, s.round ])).toEqual([ [ rowId, 2 ], [ rowId, 3 ] ]);
      expect(runAll(id)).toEqual([ "rest 60", "Bench Press A3 1/1" ]);
    });

    it("rests after a round whose last entry's set is skipped", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 2,
        restSeconds: 60
      }, {
        exerciseId: rowId,
        targetSets: 2,
        restSeconds: 30
      });

      const { id } = startSession(pushId);

      completeSet(id);
      skipSet(id);

      expect(runAll(id)).toEqual([ "rest 60", "Bench Press A2 1/2", "Row B2 2/2" ]);
    });

    it("drops an entry with fewer sets out of the later rounds", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 3,
        restSeconds: 0
      }, {
        exerciseId: rowId,
        targetSets: 1,
        restSeconds: 0
      }, {
        exerciseId: curlId,
        targetSets: 2,
        restSeconds: 0
      });

      expect(runAll(startSession(pushId).id)).toEqual([
        "Bench Press A1 1/3",
        "Row B1 2/3",
        "Curl C1 3/3",
        "Bench Press A2 1/2",
        "Curl C2 2/2",
        "Bench Press A3 1/1"
      ]);
    });

    it("rests only after each round, for the longest rest among that round's entries", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 3,
        restSeconds: 120
      }, {
        exerciseId: rowId,
        targetSets: 2,
        restSeconds: 60
      });

      const { id } = startSession(pushId);

      expect(runAll(id)).toEqual([
        "Bench Press A1 1/2",
        "Row B1 2/2",
        "rest 120",
        "Bench Press A2 1/2",
        "Row B2 2/2",
        "rest 120",
        "Bench Press A3 1/1"
      ]);
    });

    it("runs a Superset between straight-set Blocks, which show no Superset position", () => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 2,
        restSeconds: 180
      });
      createSuperset({
        exerciseId: rowId,
        targetSets: 2,
        restSeconds: 90
      }, {
        exerciseId: curlId,
        targetSets: 2,
        restSeconds: 60
      });
      createBlock(pushId, {
        exerciseId: flyId,
        targetSets: 2,
        restSeconds: 45
      });

      expect(runAll(startSession(pushId).id)).toEqual([
        "Bench Press 1",
        "rest 180",
        "Bench Press 2",
        "changeover 180",
        "Row A1 1/2",
        "Curl B1 2/2",
        "rest 90",
        "Row A2 1/2",
        "Curl B2 2/2",
        "changeover 90",
        "Cable Fly 1",
        "rest 45",
        "Cable Fly 2"
      ]);
    });

    it("rests by the round's entries once one drops out, and the rest ends that long after the round", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 2,
        restSeconds: 120
      }, {
        exerciseId: rowId,
        targetSets: 3,
        restSeconds: 60
      });
      createBlock(pushId, {
        exerciseId: curlId,
        targetSets: 1
      });

      const { id } = startSession(pushId);

      // Rounds 1 and 2: A1 → B1 → A2 → B2.
      for (let i = 0; i < 4; i++) {
        completeSet(id);
      }

      // Round 3 is Row alone, so its 60s rest applies before Curl.
      const afterRound3 = completeSet(id);
      const last = listLoggedSets(id).at(-1)!;

      expect(afterRound3.current?.exerciseName).toBe("Curl");
      expect(afterRound3.rest).toEqual({
        seconds: 60,
        endsAt: new Date(last.completedAt.getTime() + 60_000),
        changeover: true
      });
    });

    it("makes the rest a Changeover once the last round's other sets are skipped", () => {
      createSuperset({
        exerciseId: benchId,
        targetSets: 2,
        restSeconds: 90
      }, {
        exerciseId: rowId,
        targetSets: 2,
        restSeconds: 60
      });
      createBlock(pushId, {
        exerciseId: curlId,
        targetSets: 1
      });

      const { id } = startSession(pushId);

      // A1 → B1 → rest → A2, then B2 skipped.
      completeSet(id);
      expect(completeSet(id).rest?.changeover).toBe(false);
      expect(completeSet(id).rest).toBeUndefined();

      const step = skipSet(id);

      expect(step.current?.exerciseName).toBe("Curl");
      expect(step.rest).toEqual(expect.objectContaining({
        seconds: 90,
        changeover: true
      }));
    });
  });

  describe("Changeover", () => {
    beforeEach(() => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 3,
        restSeconds: 120
      });
      createBlock(pushId, {
        exerciseId: flyId,
        targetSets: 2,
        restSeconds: 45
      });
    });

    it("is not a Changeover between sets of the same Exercise Entry", () => {
      const { id } = startSession(pushId);

      expect(completeSet(id).rest).toEqual(expect.objectContaining({
        seconds: 120,
        changeover: false
      }));
    });

    it("turns the rest into a Changeover, for the finished entry's rest time, when the entry's last sets are skipped", () => {
      const { id } = startSession(pushId);

      completeSet(id);

      const step = skipSet(id);

      expect(step.current?.exerciseName).toBe("Bench Press");
      expect(step.rest?.changeover).toBe(false);

      const afterSkip = skipSet(id);
      const [ done ] = listLoggedSets(id);

      expect(afterSkip.current).toEqual(expect.objectContaining({
        exerciseName: "Cable Fly",
        setNumber: 1
      }));
      expect(afterSkip.rest).toEqual({
        seconds: 120,
        endsAt: new Date(done!.completedAt.getTime() + 120_000),
        changeover: true
      });
    });

    it("is a Changeover after Skip exercise moves on to the next Block", () => {
      const { id } = startSession(pushId);

      completeSet(id);

      expect(skipExercise(id).rest).toEqual(expect.objectContaining({
        seconds: 120,
        changeover: true
      }));
    });

    it("ends with Skip rest like any other rest", () => {
      const { id } = startSession(pushId);

      completeSet(id);
      completeSet(id);
      expect(completeSet(id).rest?.changeover).toBe(true);
      expect(skipRest(id).rest).toBeUndefined();
    });
  });

  describe("skipping, finishing early and resuming", () => {
    it("records a skipped set as skipped and moves to the next set, the rest still counting from the last set done", () => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 3,
        targetReps: 5,
        targetWeight: 80,
        restSeconds: 90
      });

      const { id } = startSession(pushId);

      completeSet(id);

      const step = skipSet(id);
      const [ done, skipped ] = listLoggedSets(id);

      expect(skipped).toEqual(expect.objectContaining({
        round: 2,
        skipped: true,
        reps: 0,
        weight: 0
      }));
      expect(done?.skipped).toBe(false);
      expect(step.current).toEqual(expect.objectContaining({ setNumber: 3 }));
      expect(step.rest?.endsAt).toEqual(new Date(done!.completedAt.getTime() + 90_000));
    });

    it("finishes early, keeping what was done and recording the sets left as skipped", () => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 2,
        targetReps: 5,
        targetWeight: 80
      });
      createBlock(pushId, {
        exerciseId: flyId,
        targetSets: 1
      });

      const { id } = startSession(pushId);

      completeSet(id);

      expect(finishSession(id).status).toBe("finished");
      const logged = listLoggedSets(id).map(s => [ s.exerciseId, s.round, s.skipped, s.reps ]);

      expect(logged).toHaveLength(3);
      expect(logged).toEqual(expect.arrayContaining([
        [ benchId, 1, false, 5 ],
        [ benchId, 2, true, 0 ],
        [ flyId, 1, true, 0 ]
      ]));
      expect(getCurrentStep(id).current).toBeUndefined();
    });

    it("allows only one Session in progress at a time", () => {
      createBlock(pushId, { exerciseId: benchId });

      const { id } = startSession(pushId);

      expect(() => startSession(pushId)).toThrow(conflictError);

      finishSession(id);

      expect(startSession(pushId).status).toBe("inProgress");
    });

    it("resumes the Session in progress at the exact set after the app is reopened", () => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 3
      });
      createBlock(pushId, {
        exerciseId: flyId,
        targetSets: 2
      });

      expect(resumeSession()).toBeUndefined();

      const { id } = startSession(pushId);

      completeSet(id);
      skipSet(id);
      completeSet(id);
      reopen();

      const step = resumeSession();

      expect(step?.session.id).toBe(id);
      expect(step?.current).toEqual(expect.objectContaining({
        exerciseName: "Cable Fly",
        setNumber: 1
      }));

      finishSession(id);

      expect(resumeSession()).toBeUndefined();
    });

    it("skips the rest of an exercise's sets and moves on to the next Block", () => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 3
      });
      createBlock(pushId, {
        exerciseId: flyId,
        targetSets: 2
      });

      const { id } = startSession(pushId);

      completeSet(id);

      const step = skipExercise(id);

      expect(listLoggedSets(id).map(s => [ s.exerciseId, s.round, s.skipped ])).toEqual([
        [ benchId, 1, false ],
        [ benchId, 2, true ],
        [ benchId, 3, true ]
      ]);
      expect(step.current).toEqual(expect.objectContaining({
        exerciseName: "Cable Fly",
        setNumber: 1
      }));
    });
  });

  describe("Skip rest", () => {
    beforeEach(() => {
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 3,
        restSeconds: 90
      });
    });

    it("ends the rest due, staying on the same set", () => {
      const { id } = startSession(pushId);

      completeSet(id);

      const step = skipRest(id);

      expect(step.rest).toBeUndefined();
      expect(step.current).toEqual(expect.objectContaining({ setNumber: 2 }));
      expect(getCurrentStep(id).rest).toBeUndefined();
    });

    it("stays skipped when the Session is resumed after the app is reopened", () => {
      const { id } = startSession(pushId);

      completeSet(id);
      skipRest(id);
      reopen();

      const step = resumeSession();

      expect(step?.current).toEqual(expect.objectContaining({ setNumber: 2 }));
      expect(step?.rest).toBeUndefined();
    });

    it("gives the set after its normal rest", () => {
      const { id } = startSession(pushId);

      completeSet(id);
      skipRest(id);

      const step = completeSet(id);
      const [ , second ] = listLoggedSets(id);

      expect(step.rest).toEqual({
        seconds: 90,
        endsAt: new Date(second!.completedAt.getTime() + 90_000),
        changeover: false
      });
    });

    it("refuses when no rest is due or the Session is finished", () => {
      const { id } = startSession(pushId);

      expect(() => skipRest(id)).toThrow(conflictError);

      completeSet(id);
      skipRest(id);

      expect(() => skipRest(id)).toThrow(conflictError);

      completeSet(id);
      finishSession(id);

      expect(() => skipRest(id)).toThrow(conflictError);
    });

    it("refuses the AI, leaving the rest running", () => {
      const { id } = startSession(pushId);

      completeSet(id);

      expect(() => skipRest(id, "ai")).toThrow(expect.objectContaining({
        statusCode: 403,
        type: "ForbiddenError"
      }) as ApiError);
      expect(getCurrentStep(id).rest?.seconds).toBe(90);
    });
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

  describe("Increase Next Time", () => {
    let benchBlockId: string;
    let benchEntryId: string;

    beforeEach(() => {
      const block = createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 2,
        targetReps: 5,
        targetWeight: 80,
        weightStep: 2.5
      });

      benchBlockId = block.id;
      benchEntryId = block.exerciseEntries[ 0 ]!.id;
    });

    it("raises the entry's target weight by its Weight Step when the Session finishes, changing nothing else", () => {
      const before = getExerciseEntry(benchEntryId);
      const { id } = startSession(pushId);

      setIncrease(id, benchEntryId, true);
      completeSet(id);
      completeSet(id);
      finishSession(id);

      expect(getExerciseEntry(benchEntryId)).toEqual({
        ...before,
        targetWeight: 82.5,
        updatedAt: expect.any(Date) as unknown
      });
    });

    it("shows the toggle's current state, applying only what's on at the finish after on, off, on", () => {
      const { id } = startSession(pushId);

      expect(getCurrentStep(id).increases).toEqual([]);
      expect(setIncrease(id, benchEntryId, true).increases).toEqual([ benchEntryId ]);
      expect(setIncrease(id, benchEntryId, false).increases).toEqual([]);

      completeSet(id);

      expect(setIncrease(id, benchEntryId, true).increases).toEqual([ benchEntryId ]);
      expect(resumeSession()?.increases).toEqual([ benchEntryId ]);

      completeSet(id);
      finishSession(id);

      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(82.5);
    });

    it("leaves the target weight alone when the toggle ends off", () => {
      const { id } = startSession(pushId);

      setIncrease(id, benchEntryId, true);
      setIncrease(id, benchEntryId, false);
      finishSession(id);

      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(80);
    });

    it("applies on an early finish", () => {
      const { id } = startSession(pushId);

      setIncrease(id, benchEntryId, true);
      finishSession(id);

      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(82.5);
    });

    it("applies once, and won't toggle a finished Session", () => {
      const { id } = startSession(pushId);

      setIncrease(id, benchEntryId, true);
      finishSession(id);

      expect(() => finishSession(id)).toThrow(conflictError);
      expect(() => setIncrease(id, benchEntryId, false)).toThrow(conflictError);
      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(82.5);

      const next = startSession(pushId);

      finishSession(next.id);

      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(82.5);
    });

    it("toggles each exercise of a Superset on its own, each by its own Weight Step", () => {
      const { id: curlId } = createExercise({
        name: "Curl",
        muscleGroups: [ "biceps" ]
      });
      const flyBlock = createBlock(pushId, {
        exerciseId: flyId,
        targetWeight: 20,
        weightStep: 1
      });
      const curlBlock = createBlock(pushId, {
        exerciseId: curlId,
        targetWeight: 10,
        weightStep: 1
      });
      const [ flyEntryId, curlEntryId ] = [ flyBlock, curlBlock ].map(b => b.exerciseEntries[ 0 ]!.id);

      groupBlocks(pushId, [ flyBlock.id, curlBlock.id ]);

      const { id } = startSession(pushId);

      setIncrease(id, flyEntryId!, true);
      setIncrease(id, curlEntryId!, true);
      setIncrease(id, curlEntryId!, false);
      setIncrease(id, benchEntryId, true);
      finishSession(id);

      expect(getExerciseEntry(benchEntryId).targetWeight).toBe(82.5);
      expect(getExerciseEntry(flyEntryId!).targetWeight).toBe(21);
      expect(getExerciseEntry(curlEntryId!).targetWeight).toBe(10);
    });

    it("rejects an Exercise Entry that isn't in the Session", () => {
      const { id } = startSession(pushId);
      const laterEntryId = createBlock(pushId, { exerciseId: flyId }).exerciseEntries[ 0 ]!.id;

      expect(() => setIncrease(id, laterEntryId, true)).toThrow(notFoundError);
      expect(() => setIncrease(id, "not-a-uuid", true)).toThrow(validationError);
      expect(getCurrentStep(id).increases).toEqual([]);
    });

    it("still finishes, raising the rest, when a toggled entry is deleted from the Workout mid-Session", () => {
      const flyEntryId = createBlock(pushId, {
        exerciseId: flyId,
        targetWeight: 20,
        weightStep: 1
      }).exerciseEntries[ 0 ]!.id;
      const { id } = startSession(pushId);

      setIncrease(id, benchEntryId, true);
      setIncrease(id, flyEntryId, true);
      deleteBlock(benchBlockId);

      expect(finishSession(id).status).toBe("finished");
      expect(getExerciseEntry(flyEntryId).targetWeight).toBe(21);
    });
  });
});
