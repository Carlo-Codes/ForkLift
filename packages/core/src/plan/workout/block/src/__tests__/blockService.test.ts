import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createBlock,
  deleteBlock,
  getBlock,
  groupBlocks,
  listBlocks,
  reorderBlocks,
  ungroupBlock
} from "..";
import { createExercise, deleteExercise } from "#exercise";
import { setUnit } from "#setting";
import { createPlan, deletePlan } from "#plan";
import { createWorkout, deleteWorkout } from "#workout";
import {
  createExerciseEntry,
  deleteExerciseEntry,
  getExerciseEntry,
  reorderExerciseEntries,
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
