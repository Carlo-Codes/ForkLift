import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  addExerciseToWorkout,
  createBlock,
  createExerciseInWorkout,
  deleteBlock,
  getBlock,
  groupBlocks,
  listBlocks,
  reorderBlocks,
  setRoundRest,
  ungroupBlock
} from "..";
import {
  createExercise, deleteExercise, searchExercises
} from "#exercise";
import { setUnit } from "#setting";
import { createPlan, deletePlan } from "#plan";
import { createWorkout, deleteWorkout } from "#workout";
import {
  createExerciseEntry,
  deleteExerciseEntry,
  getExerciseEntry,
  reorderExerciseEntries,
  restoreExerciseEntry,
  roundRest,
  updateExerciseEntry
} from "#exerciseEntry";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("blocks and exercise entries", () => {
  let teardown: () => void;
  let workoutId: string;
  let benchId: string;
  let rowId: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: workoutId } = createWorkout(createPlan({ name: "PPL" }).id, { name: "Push" }));
    ({ id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    }));
    ({ id: rowId } = createExercise({
      name: "Barbell Row",
      muscleGroups: [ "back" ]
    }));
  });

  afterEach(() => teardown());

  describe("Add exercise in the Plan editor", () => {
    it("adds the Exercise as a new Block at the end, with default targets", () => {
      createBlock(workoutId, { exerciseId: rowId });
      addExerciseToWorkout({ workoutId }, benchId);

      expect(listBlocks(workoutId).map(b => b.exerciseEntries.map(e => [
        e.exercise.name,
        e.targetSets,
        e.targetReps,
        e.restSeconds
      ]))).toEqual([
        [
          [
            "Barbell Row",
            3,
            10,
            90
          ]
        ],
        [
          [
            "Bench Press",
            3,
            10,
            90
          ]
        ]
      ]);
    });

    it("adds the Exercise to the Superset it names", () => {
      const block = createBlock(workoutId, { exerciseId: rowId });

      addExerciseToWorkout({
        workoutId,
        blockId: block.id
      }, benchId);

      expect(getBlock(block.id).exerciseEntries.map(e => e.exercise.name)).toEqual([ "Barbell Row", "Bench Press" ]);
    });

    it("creates a new Exercise and adds it in one go", () => {
      const block = createExerciseInWorkout({ workoutId }, {
        name: "Landmine Press",
        muscleGroups: [ "shoulders" ]
      });

      expect(block.exerciseEntries.map(e => e.exercise.name)).toEqual([ "Landmine Press" ]);
      expect(searchExercises("Landmine").map(e => e.name)).toEqual([ "Landmine Press" ]);
    });

    it("adds neither the Exercise nor the Block when adding to the Workout fails", () => {
      deleteWorkout(workoutId);

      expect(() => createExerciseInWorkout({ workoutId }, {
        name: "Landmine Press",
        muscleGroups: [ "shoulders" ]
      })).toThrow(notFoundError);
      expect(searchExercises("Landmine")).toEqual([]);
    });
  });

  it("fills a Block's Exercise Entry with default targets", () => {
    const block = createBlock(workoutId, { exerciseId: benchId });

    expect(block.exerciseEntries).toEqual([
      expect.objectContaining({
        exerciseId: benchId,
        targetSets: 3,
        targetReps: 10,
        targetWeight: 0,
        restSeconds: 90,
        weightStep: 2.5,
        exercise: expect.objectContaining({ name: "Bench Press" }) as unknown
      })
    ]);
  });

  it("defaults the Weight Step to 5 when the unit is lb", () => {
    setUnit("lb");

    const block = createBlock(workoutId, { exerciseId: benchId });

    expect(block.exerciseEntries[ 0 ]?.weightStep).toBe(5);
  });

  it("keeps the targets the lifter sets", () => {
    const block = createBlock(workoutId, {
      exerciseId: benchId,
      targetSets: 5,
      targetReps: 5,
      targetWeight: 82.5,
      restSeconds: 180,
      weightStep: 1.25
    });
    const entryId = block.exerciseEntries[ 0 ]!.id;

    updateExerciseEntry(entryId, {
      targetReps: 3,
      targetWeight: 90
    });

    expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
      targetSets: 5,
      targetReps: 3,
      targetWeight: 90,
      restSeconds: 180,
      weightStep: 1.25
    }));
  });

  it("rejects impossible targets and keeps the entry as it was", () => {
    expect(() => createBlock(workoutId, {
      exerciseId: benchId,
      targetSets: 0
    })).toThrow(validationError);
    expect(listBlocks(workoutId)).toEqual([]);

    const entryId = createBlock(workoutId, { exerciseId: benchId }).exerciseEntries[ 0 ]!.id;

    expect(() => updateExerciseEntry(entryId, { targetReps: 2.5 })).toThrow(validationError);
    expect(() => updateExerciseEntry(entryId, { targetWeight: -5 })).toThrow(validationError);
    expect(() => updateExerciseEntry(entryId, { weightStep: 0 })).toThrow(validationError);
    expect(() => updateExerciseEntry(entryId, { restSeconds: Number.NaN })).toThrow(validationError);
    expect(getExerciseEntry(entryId)).toEqual(expect.objectContaining({
      targetReps: 10,
      targetWeight: 0,
      weightStep: 2.5,
      restSeconds: 90
    }));
  });

  it("refuses an Exercise that isn't in the library", () => {
    const deleted = createExercise({
      name: "Pec Deck",
      muscleGroups: [ "chest" ]
    });

    deleteExercise(deleted.id);

    expect(() => createBlock(workoutId, { exerciseId: crypto.randomUUID() })).toThrow(notFoundError);
    expect(() => createBlock(workoutId, { exerciseId: deleted.id })).toThrow(notFoundError);
    expect(listBlocks(workoutId)).toEqual([]);
  });

  it("lists, reorders and deletes a Workout's Blocks", () => {
    const bench = createBlock(workoutId, { exerciseId: benchId });
    const row = createBlock(workoutId, { exerciseId: rowId });
    const names = () => listBlocks(workoutId).map(b => b.exerciseEntries[ 0 ]?.exercise.name);

    expect(names()).toEqual([ "Bench Press", "Barbell Row" ]);

    reorderBlocks(workoutId, [ row.id, bench.id ]);

    expect(names()).toEqual([ "Barbell Row", "Bench Press" ]);
    expect(() => reorderBlocks(workoutId, [ row.id ])).toThrow(validationError);

    deleteBlock(row.id);

    expect(names()).toEqual([ "Bench Press" ]);
    expect(() => getBlock(row.id)).toThrow(notFoundError);
    expect(() => getExerciseEntry(row.exerciseEntries[ 0 ]!.id)).toThrow(notFoundError);
  });

  it("orders, reorders and deletes Exercise Entries within a Block", () => {
    const block = createBlock(workoutId, { exerciseId: benchId });
    const bench = block.exerciseEntries[ 0 ]!;
    const row = createExerciseEntry(block.id, { exerciseId: rowId });
    const names = () => getBlock(block.id).exerciseEntries.map(e => e.exercise.name);

    expect(names()).toEqual([ "Bench Press", "Barbell Row" ]);

    reorderExerciseEntries(block.id, [ row.id, bench.id ]);

    expect(names()).toEqual([ "Barbell Row", "Bench Press" ]);

    deleteExerciseEntry(row.id);

    expect(names()).toEqual([ "Bench Press" ]);
  });

  it("deletes a Block along with its last Exercise Entry", () => {
    const block = createBlock(workoutId, { exerciseId: benchId });

    deleteExerciseEntry(block.exerciseEntries[ 0 ]!.id);

    expect(listBlocks(workoutId)).toEqual([]);
    expect(() => getBlock(block.id)).toThrow(notFoundError);
  });

  it("groups adjacent Blocks into a Superset, keeping their entries in order", () => {
    const squatId = createExercise({
      name: "Squat",
      muscleGroups: [ "quads" ]
    }).id;
    const squat = createBlock(workoutId, { exerciseId: squatId });
    const bench = createBlock(workoutId, {
      exerciseId: benchId,
      targetSets: 5
    });
    const row = createBlock(workoutId, {
      exerciseId: rowId,
      targetSets: 3
    });
    const benchEntryId = bench.exerciseEntries[ 0 ]!.id;

    const superset = groupBlocks(workoutId, [ bench.id, row.id ]);

    expect(superset.exerciseEntries.map(e => [ e.exercise.name, e.targetSets ])).toEqual([
      [ "Bench Press", 5 ],
      [ "Barbell Row", 3 ]
    ]);
    expect(superset.exerciseEntries[ 0 ]!.id).toBe(benchEntryId);
    expect(listBlocks(workoutId).map(b => b.exerciseEntries.map(e => e.exercise.name))).toEqual([
      [ "Squat" ],
      [ "Bench Press", "Barbell Row" ]
    ]);

    // Grouping a Superset with its neighbour adds that neighbour's entries.
    const all = groupBlocks(workoutId, [ squat.id, superset.id ]);

    expect(all.exerciseEntries.map(e => e.exercise.name)).toEqual([ "Squat", "Bench Press", "Barbell Row" ]);
    expect(listBlocks(workoutId)).toHaveLength(1);
  });

  it("only groups two or more adjacent Blocks of the Workout", () => {
    const squatId = createExercise({
      name: "Squat",
      muscleGroups: [ "quads" ]
    }).id;
    const bench = createBlock(workoutId, { exerciseId: benchId });
    createBlock(workoutId, { exerciseId: squatId });
    const row = createBlock(workoutId, { exerciseId: rowId });
    const other = createBlock(createWorkout(createPlan({ name: "Other" }).id, { name: "Pull" }).id, { exerciseId: rowId });

    expect(() => groupBlocks(workoutId, [ bench.id ])).toThrow(validationError);
    expect(() => groupBlocks(workoutId, [ bench.id, row.id ])).toThrow(validationError);
    expect(() => groupBlocks(workoutId, [ bench.id, bench.id ])).toThrow(validationError);
    expect(() => groupBlocks(workoutId, [ row.id, other.id ])).toThrow(validationError);
    expect(listBlocks(workoutId).map(b => b.exerciseEntries.length)).toEqual([ 1, 1, 1 ]);
  });

  it("splits a Superset back into single Blocks in its place", () => {
    const squatId = createExercise({
      name: "Squat",
      muscleGroups: [ "quads" ]
    }).id;
    const bench = createBlock(workoutId, {
      exerciseId: benchId,
      targetSets: 5
    });
    const row = createBlock(workoutId, {
      exerciseId: rowId,
      targetSets: 3
    });
    const squat = createBlock(workoutId, { exerciseId: squatId });
    const superset = groupBlocks(workoutId, [ bench.id, row.id ]);
    const entryIds = superset.exerciseEntries.map(e => e.id);

    const split = ungroupBlock(superset.id);

    expect(split.map(b => b.exerciseEntries.map(e => e.id))).toEqual(entryIds.map(id => [ id ]));
    expect(split.map(b => b.exerciseEntries[ 0 ]!.targetSets)).toEqual([ 5, 3 ]);
    expect(split[ 0 ]!.id).toBe(superset.id);
    expect(listBlocks(workoutId).map(b => b.id)).toEqual([ ...split.map(b => b.id), squat.id ]);
    expect(listBlocks(workoutId).map(b => b.exerciseEntries[ 0 ]!.exercise.name)).toEqual([ "Bench Press", "Barbell Row", "Squat" ]);

    // A Block of straight sets is already split.
    expect(ungroupBlock(squat.id).map(b => b.id)).toEqual([ squat.id ]);
    expect(() => ungroupBlock(crypto.randomUUID())).toThrow(notFoundError);
  });

  it("reorders, adds and removes entries within a Superset", () => {
    const squatId = createExercise({
      name: "Squat",
      muscleGroups: [ "quads" ]
    }).id;
    const superset = groupBlocks(workoutId, [
      createBlock(workoutId, { exerciseId: benchId }).id,
      createBlock(workoutId, { exerciseId: rowId }).id
    ]);
    const [ bench, row ] = superset.exerciseEntries;
    const names = () => getBlock(superset.id).exerciseEntries.map(e => e.exercise.name);

    reorderExerciseEntries(superset.id, [ row!.id, bench!.id ]);

    expect(names()).toEqual([ "Barbell Row", "Bench Press" ]);

    const squat = createExerciseEntry(superset.id, {
      exerciseId: squatId,
      targetSets: 4
    });

    expect(names()).toEqual([ "Barbell Row", "Bench Press", "Squat" ]);
    expect(getBlock(superset.id).exerciseEntries.map(e => e.targetSets)).toEqual([ 3, 3, 4 ]);
    expect(() => reorderExerciseEntries(superset.id, [ row!.id, bench!.id ])).toThrow(validationError);

    deleteExerciseEntry(bench!.id);
    deleteExerciseEntry(row!.id);

    // Down to one entry, the Block is straight sets again.
    expect(listBlocks(workoutId).map(b => b.exerciseEntries.map(e => e.id))).toEqual([ [ squat.id ] ]);
  });

  describe("Round Rest", () => {
    const supersetOf = (...rests: number[]) => groupBlocks(workoutId, rests.map((restSeconds, i) => createBlock(workoutId, {
      exerciseId: i % 2 === 0 ? benchId : rowId,
      restSeconds
    }).id));

    it("is the longest rest among a Superset's Exercise Entries", () => {
      expect(roundRest(supersetOf(60, 120, 90).exerciseEntries)).toBe(120);
      expect(roundRest([])).toBeUndefined();
    });

    it("sets the rest of every Exercise Entry in the Superset", () => {
      const superset = supersetOf(60, 120);

      expect(setRoundRest(superset.id, 75).exerciseEntries.map(e => e.restSeconds)).toEqual([ 75, 75 ]);
      expect(getBlock(superset.id).exerciseEntries.map(e => e.restSeconds)).toEqual([ 75, 75 ]);
    });

    it("rejects an impossible rest and keeps the Superset as it was", () => {
      const superset = supersetOf(60, 120);

      expect(() => setRoundRest(superset.id, -5)).toThrow(validationError);
      expect(() => setRoundRest(superset.id, 1.5)).toThrow(validationError);
      expect(getBlock(superset.id).exerciseEntries.map(e => e.restSeconds)).toEqual([ 60, 120 ]);
    });

    it("refuses a Block that isn't there", () => {
      const superset = supersetOf(60, 120);

      deleteBlock(superset.id);

      expect(() => setRoundRest(superset.id, 90)).toThrow(notFoundError);
    });

    it("is the rest an Exercise Entry added to the Superset takes, unless it's given one", () => {
      const superset = supersetOf(60, 120);

      addExerciseToWorkout({
        workoutId,
        blockId: superset.id
      }, benchId);
      createExerciseEntry(superset.id, {
        exerciseId: rowId,
        restSeconds: 30
      });

      expect(getBlock(superset.id).exerciseEntries.map(e => e.restSeconds)).toEqual([ 60, 120, 120, 30 ]);
    });
  });

  describe("Undo of a removed Exercise Entry", () => {
    it("puts the entry back in its place in the Superset", () => {
      const superset = groupBlocks(workoutId, [
        createBlock(workoutId, { exerciseId: benchId }).id,
        createBlock(workoutId, { exerciseId: rowId }).id
      ]);
      const [ bench ] = superset.exerciseEntries;

      deleteExerciseEntry(bench!.id);
      restoreExerciseEntry(bench!.id);

      expect(getBlock(superset.id).exerciseEntries.map(e => e.exercise.name)).toEqual([ "Bench Press", "Barbell Row" ]);
    });

    it("brings back the Block its last entry took with it, in its place", () => {
      const [ first, , last ] = [ benchId, rowId, benchId ].map(exerciseId => createBlock(workoutId, { exerciseId }));
      const entry = first!.exerciseEntries[ 0 ]!;

      updateExerciseEntry(entry.id, { targetSets: 5 });
      deleteExerciseEntry(entry.id);

      expect(listBlocks(workoutId)).toHaveLength(2);

      restoreExerciseEntry(entry.id);

      expect(listBlocks(workoutId).map(b => b.id)).toEqual([ first!.id, expect.any(String), last!.id ]);
      expect(getExerciseEntry(entry.id).targetSets).toBe(5);
    });

    it("does nothing for an entry that wasn't removed", () => {
      const block = createBlock(workoutId, { exerciseId: benchId });
      const entry = block.exerciseEntries[ 0 ]!;

      expect(restoreExerciseEntry(entry.id).deletedAt).toBeNull();
      expect(getBlock(block.id).exerciseEntries).toHaveLength(1);
    });

    it("refuses once the Workout is gone", () => {
      const entry = createBlock(workoutId, { exerciseId: benchId }).exerciseEntries[ 0 ]!;

      deleteExerciseEntry(entry.id);
      deleteWorkout(workoutId);

      expect(() => restoreExerciseEntry(entry.id)).toThrow(notFoundError);
    });
  });

  it("deletes Blocks and entries with their Workout or Plan", () => {
    const planId = createPlan({ name: "Upper / Lower" }).id;
    const upper = createWorkout(planId, { name: "Upper" });
    const fromWorkout = createBlock(workoutId, { exerciseId: benchId });
    const fromPlan = createBlock(upper.id, { exerciseId: rowId });

    deleteWorkout(workoutId);
    deletePlan(planId);

    for (const block of [ fromWorkout, fromPlan ]) {
      expect(() => getBlock(block.id)).toThrow(notFoundError);
      expect(() => getExerciseEntry(block.exerciseEntries[ 0 ]!.id)).toThrow(notFoundError);
    }

    expect(() => listBlocks(workoutId)).toThrow(notFoundError);
    expect(() => createBlock(workoutId, { exerciseId: benchId })).toThrow(notFoundError);
  });
});
