import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createBlock,
  deleteBlock,
  getBlock,
  listBlocks,
  reorderBlocks
} from "..";
import { createExercise, deleteExercise } from "../../../../../exercise/src";
import { setUnit } from "../../../../../setting/src";
import { createPlan, deletePlan } from "../../../../src";
import { createWorkout, deleteWorkout } from "../../../src";
import {
  createExerciseEntry,
  deleteExerciseEntry,
  getExerciseEntry,
  reorderExerciseEntries,
  updateExerciseEntry
} from "../../exerciseEntry/src";

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
