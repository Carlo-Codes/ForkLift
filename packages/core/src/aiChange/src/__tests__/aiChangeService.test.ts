import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import { listAiChanges, undoAiChange } from "..";
import {
  createExercise, deleteExercise, getExercise, searchExercises, updateExercise
} from "#exercise";
import {
  createExerciseEntry, deleteExerciseEntry, getExerciseEntry, updateExerciseEntry
} from "#exerciseEntry";
import {
  createPlan, deletePlan, getActivePlan, getPlan, listPlans, setActivePlan, updatePlan
} from "#plan";
import { createBlock, listBlocks, setRoundRest } from "#block";
import { setUnit } from "#setting";
import {
  createWorkout, deleteWorkout, getWorkout, listWorkouts, reorderWorkouts, updateWorkout
} from "#workout";
import {
  completeSet, finishSession, getCurrentStep, getSession, setIncrease, skipExercise, skipSet, startSession
} from "#session";

const forbidden = expect.objectContaining({
  statusCode: 403,
  type: "ForbiddenError"
}) as ApiError;

describe("Changes by AI", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("records a Plan the AI creates, but not one the lifter does", () => {
    createPlan({ name: "Mine" });
    createPlan({ name: "PPL" }, "ai");

    expect(listAiChanges()).toEqual([
      expect.objectContaining({
        summary: "Created Plan \"PPL\"",
        createdAt: expect.any(Date) as Date,
        undoneAt: null
      })
    ]);
  });

  it("undoes a Plan the AI created, once however often Undo is tapped", () => {
    createPlan({ name: "PPL" }, "ai");

    const [ change ] = listAiChanges();
    const undone = undoAiChange(change!.id);

    expect(undone.undoneAt).toEqual(expect.any(Date));
    expect(listPlans()).toEqual([]);
    expect(undoAiChange(change!.id).undoneAt).toEqual(undone.undoneAt);
    expect(listAiChanges()).toHaveLength(1);
  });

  describe("on a Plan's dates", () => {
    it("records the dates of a Plan the AI creates", () => {
      createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }, "ai");

      expect(listAiChanges()[ 0 ]!.summary).toBe("Created Plan \"PPL\" to run from 2026-11-02 to 2026-12-27");
    });

    it("says how the dates changed, and undoes them", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02"
      });

      updatePlan(id, {
        startDate: null,
        endDate: "2026-12-27"
      }, "ai");
      updatePlan(id, {
        name: "Push / Pull / Legs",
        endDate: null
      }, "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([
        "Renamed Plan \"PPL\" to \"Push / Pull / Legs\"; Set Plan \"Push / Pull / Legs\" to run with no dates",
        "Set Plan \"PPL\" to run until 2026-12-27"
      ]);

      for (const change of listAiChanges()) {
        undoAiChange(change.id);
      }

      expect(getPlan(id)).toEqual(expect.objectContaining({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: null
      }));
    });

    it("keeps a date the lifter has changed since, undoing the rest", () => {
      const { id } = createPlan({ name: "PPL" });

      updatePlan(id, {
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }, "ai");
      updatePlan(id, { endDate: "2027-01-03" });
      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(getPlan(id)).toEqual(expect.objectContaining({
        startDate: null,
        endDate: "2027-01-03"
      }));
    });

    it("keeps the dates whole rather than undo To to before a From the lifter moved", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-01-05",
        endDate: "2026-03-01"
      });

      updatePlan(id, {
        name: "Push / Pull / Legs",
        endDate: "2026-12-27"
      }, "ai");
      updatePlan(id, { startDate: "2026-06-01" });
      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(getPlan(id)).toEqual(expect.objectContaining({
        name: "PPL",
        startDate: "2026-06-01",
        endDate: "2026-12-27"
      }));
    });
  });

  it("undoes a rename, keeping what the lifter has changed since", () => {
    const { id: planId } = createPlan({ name: "PPL" });
    const { id } = createWorkout(planId, { name: "Push" });
    const { id: pullId } = createWorkout(planId, { name: "Pull" });

    updateWorkout(id, { name: "Push A" }, "ai");
    reorderWorkouts(planId, [ pullId, id ]);

    expect(listAiChanges()[ 0 ]!.summary).toBe("Renamed Workout \"Push\" to \"Push A\"");

    undoAiChange(listAiChanges()[ 0 ]!.id);

    expect(listWorkouts(planId).map(w => w.name)).toEqual([ "Pull", "Push" ]);
  });

  it("restores a Workout the AI deleted, with its Blocks", () => {
    const { id: planId } = createPlan({ name: "PPL" });
    const { id } = createWorkout(planId, { name: "Push" });

    createBlock(id, {
      exerciseId: createExercise({
        name: "Bench Press",
        muscleGroups: [ "chest" ]
      }).id,
      targetWeight: 60
    });
    deleteWorkout(id, "ai");

    expect(listAiChanges()[ 0 ]!.summary).toBe("Deleted Workout \"Push\" from Plan \"PPL\"");
    expect(() => getWorkout(id)).toThrow();

    undoAiChange(listAiChanges()[ 0 ]!.id);

    expect(getWorkout(id).name).toBe("Push");
    expect(listBlocks(id)).toEqual([
      expect.objectContaining({
        exerciseEntries: [
          expect.objectContaining({
            targetWeight: 60,
            exercise: expect.objectContaining({ name: "Bench Press" }) as unknown
          })
        ]
      })
    ]);
  });

  describe("on a Workout's Exercise Entries", () => {
    let workoutId: string;
    let benchId: string;
    let entryId: string;

    beforeEach(() => {
      const { id: planId } = createPlan({ name: "PPL" });

      ({ id: workoutId } = createWorkout(planId, { name: "Push" }));
      ({ id: benchId } = createExercise({
        name: "Bench Press",
        muscleGroups: [ "chest" ]
      }));
      entryId = createBlock(workoutId, {
        exerciseId: benchId,
        targetSets: 3,
        targetWeight: 60
      }).exerciseEntries[ 0 ]!.id;
    });

    it("records one change for a Block, its Exercise Entry included, and undoes both", () => {
      createBlock(workoutId, { exerciseId: benchId }, "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([ "Added Bench Press to Workout \"Push\"" ]);
      expect(listBlocks(workoutId)).toHaveLength(2);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(listBlocks(workoutId).map(b => b.exerciseEntries.map(e => e.id))).toEqual([ [ entryId ] ]);
    });

    it("says which targets changed, and undoes them", () => {
      updateExerciseEntry(entryId, {
        targetSets: 4,
        targetWeight: 62.5
      }, "ai");

      expect(listAiChanges()[ 0 ]!.summary)
        .toBe("Changed Bench Press in Workout \"Push\": sets 3 → 4, weight 60kg → 62.5kg");

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
        targetSets: 3,
        targetWeight: 60
      }));
    });

    it("records a Round Rest the AI sets, and undoes it entry by entry", () => {
      const { id: rowId } = createExercise({
        name: "Barbell Row",
        muscleGroups: [ "back" ]
      });
      const blockId = listBlocks(workoutId)[ 0 ]!.id;

      createExerciseEntry(blockId, {
        exerciseId: rowId,
        restSeconds: 60
      });
      setRoundRest(blockId, 120, "ai");

      expect(listAiChanges()[ 0 ]!.summary)
        .toBe("Set the Round Rest of Bench Press + Barbell Row in Workout \"Push\" to 120s");

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(listBlocks(workoutId)[ 0 ]!.exerciseEntries.map(e => e.restSeconds)).toEqual([ 90, 60 ]);
    });

    it("keeps a target the lifter has changed since, undoing the rest", () => {
      updateExerciseEntry(entryId, {
        targetSets: 4,
        targetWeight: 70
      }, "ai");
      updateExerciseEntry(entryId, { targetWeight: 72.5 });

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
        targetSets: 3,
        targetWeight: 72.5
      }));
    });

    describe("after the lifter switches unit", () => {
      beforeEach(() => {
        updateExerciseEntry(entryId, {
          targetWeight: 62.5,
          weightStep: 1
        }, "ai");
      });

      it("undoes the targets in the new unit", () => {
        setUnit("lb");
        undoAiChange(listAiChanges()[ 0 ]!.id);

        expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
          targetWeight: 132.3,
          weightStep: 5
        }));
      });

      it("undoes the targets after switching there and back", () => {
        setUnit("lb");
        setUnit("kg");
        undoAiChange(listAiChanges()[ 0 ]!.id);

        expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
          targetWeight: 60,
          weightStep: 2.5
        }));
      });

      it("keeps a target the lifter has changed since the switch", () => {
        setUnit("lb");
        updateExerciseEntry(entryId, { targetWeight: 140 });
        undoAiChange(listAiChanges()[ 0 ]!.id);

        expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
          targetWeight: 140,
          weightStep: 5
        }));
      });
    });

    it("restores the last Exercise Entry of a Block, and the Block it took with it", () => {
      deleteExerciseEntry(entryId, "ai");

      expect(listBlocks(workoutId)).toEqual([]);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(listBlocks(workoutId).map(b => b.exerciseEntries.map(e => e.id))).toEqual([ [ entryId ] ]);
    });

    it("changes the Workout of the Session in progress from the next Session", () => {
      const { id: sessionId } = startSession(workoutId);

      updateExerciseEntry(entryId, { targetWeight: 70 }, "ai");

      expect(getCurrentStep(sessionId).current?.targetWeight).toBe(60);

      finishSession(sessionId);

      expect(getCurrentStep(startSession(workoutId).id).current?.targetWeight).toBe(70);
    });

    it("records nothing for a write that changes nothing", () => {
      updateExerciseEntry(entryId, { targetSets: 3 }, "ai");

      expect(listAiChanges()).toEqual([]);
    });
  });

  it("undoes adding, editing and deleting Exercises", () => {
    const { id } = createExercise({
      name: "Landmine Press",
      muscleGroups: [ "shoulders" ]
    }, "ai");

    updateExercise(id, { name: "Half-kneeling Landmine Press" }, "ai");
    deleteExercise(id, "ai");

    const [ deleted, renamed, added ] = listAiChanges();

    expect([ deleted!.summary, renamed!.summary, added!.summary ]).toEqual([
      "Deleted \"Half-kneeling Landmine Press\" from the Exercise Library",
      "Renamed Exercise \"Landmine Press\" to \"Half-kneeling Landmine Press\"",
      "Added \"Landmine Press\" to the Exercise Library"
    ]);

    undoAiChange(deleted!.id);
    undoAiChange(renamed!.id);

    expect(getExercise(id).name).toBe("Landmine Press");

    undoAiChange(added!.id);

    expect(searchExercises("Landmine")).toEqual([]);
  });

  it("answers Undo of a change that doesn't exist with not found", () => {
    expect(() => undoAiChange(crypto.randomUUID())).toThrow(expect.objectContaining({ statusCode: 404 }) as ApiError);
  });

  describe("what the AI can never do", () => {
    let planId: string;
    let workoutId: string;
    let entryId: string;

    beforeEach(() => {
      ({ id: planId } = createPlan({ name: "PPL" }));
      ({ id: workoutId } = createWorkout(planId, { name: "Push" }));
      entryId = createBlock(workoutId, {
        exerciseId: createExercise({
          name: "Bench Press",
          muscleGroups: [ "chest" ]
        }).id
      }).exerciseEntries[ 0 ]!.id;
      setActivePlan(planId);
    });

    afterEach(() => {
      expect(listAiChanges()).toEqual([]);
    });

    it("changes which Plan is Active, by choosing one or deleting it", () => {
      const { id: otherId } = createPlan({ name: "Upper / Lower" });

      expect(() => setActivePlan(otherId, "ai")).toThrow(forbidden);
      expect(() => setActivePlan(null, "ai")).toThrow(forbidden);
      expect(() => deletePlan(planId, "ai")).toThrow(forbidden);
      expect(getActivePlan()?.id).toBe(planId);
    });

    it("starts, logs or finishes a Session", () => {
      expect(() => startSession(workoutId, "ai")).toThrow(forbidden);

      const { id: sessionId } = startSession(workoutId);

      expect(() => completeSet(sessionId, {}, "ai")).toThrow(forbidden);
      expect(() => skipSet(sessionId, "ai")).toThrow(forbidden);
      expect(() => skipExercise(sessionId, "ai")).toThrow(forbidden);
      expect(() => setIncrease(sessionId, entryId, true, "ai")).toThrow(forbidden);
      expect(() => finishSession(sessionId, "ai")).toThrow(forbidden);
      expect(getSession(sessionId).status).toBe("inProgress");
    });
  });
});
