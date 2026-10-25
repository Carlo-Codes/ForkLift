import { setupTestDb } from "@forklift/db/server";
import type { Equipment, MuscleGroup } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  loadBuiltInExercises,
  searchExercises,
  updateExercise
} from "..";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("exercise library", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("lists an exercise the lifter adds", () => {
    const created = createExercise({
      name: "Landmine Press",
      muscleGroups: [ "shoulders", "chest" ],
      equipment: "barbell",
      notes: "Stagger stance"
    });

    expect(listExercises()).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "Landmine Press",
        muscleGroups: [ "shoulders", "chest" ],
        equipment: "barbell",
        notes: "Stagger stance",
        isBuiltIn: false
      })
    ]);
  });

  it("rejects an exercise without a name and adds nothing", () => {
    expect(() => createExercise({
      name: "   ",
      muscleGroups: []
    })).toThrow(validationError);
    expect(listExercises()).toEqual([]);
  });

  it("rejects a muscle group outside the known list", () => {
    expect(() => createExercise({
      name: "Neck Curl",
      muscleGroups: [ "neck" as MuscleGroup ]
    })).toThrow(validationError);
    expect(listExercises()).toEqual([]);
  });

  it("rejects equipment outside the known list", () => {
    expect(() => createExercise({
      name: "Sled Push",
      muscleGroups: [ "quads" ],
      equipment: "sled" as Equipment
    })).toThrow(validationError);
    expect(listExercises()).toEqual([]);
  });

  it("keeps the lifter's edits and leaves other fields alone", () => {
    const { id } = createExercise({
      name: "Bench",
      muscleGroups: [ "chest" ],
      equipment: "barbell",
      notes: "Arch"
    });

    updateExercise(id, {
      name: "Bench Press",
      notes: null
    });

    expect(getExercise(id)).toEqual(expect.objectContaining({
      name: "Bench Press",
      muscleGroups: [ "chest" ],
      equipment: "barbell",
      notes: null
    }));
  });

  it("rejects an invalid edit and keeps the exercise as it was", () => {
    const { id } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    });

    expect(() => updateExercise(id, { name: "" })).toThrow(validationError);
    expect(getExercise(id).name).toBe("Bench Press");
  });

  it("reports a missing exercise as not found", () => {
    const missingId = crypto.randomUUID();

    expect(() => getExercise(missingId)).toThrow(notFoundError);
    expect(() => updateExercise(missingId, { name: "Squat" })).toThrow(notFoundError);
  });

  it("hides a deleted exercise and keeps the rest", () => {
    const squat = createExercise({
      name: "Squat",
      muscleGroups: [ "quads" ]
    });
    const deadlift = createExercise({
      name: "Deadlift",
      muscleGroups: [ "hamstrings" ]
    });

    deleteExercise(squat.id);

    expect(listExercises().map(e => e.id)).toEqual([ deadlift.id ]);
    expect(() => getExercise(squat.id)).toThrow(notFoundError);
    expect(() => deleteExercise(squat.id)).toThrow(notFoundError);
  });

  it("finds exercises by any part of the name, ignoring case, in name order", () => {
    for (const name of [
      "Romanian Deadlift",
      "bench press",
      "Deadlift",
      "Overhead Press"
    ]) {
      createExercise({
        name,
        muscleGroups: []
      });
    }

    const deleted = createExercise({
      name: "Deficit Deadlift",
      muscleGroups: []
    });

    deleteExercise(deleted.id);

    expect(searchExercises("deadLIFT").map(e => e.name)).toEqual([ "Deadlift", "Romanian Deadlift" ]);
    expect(searchExercises("  press ").map(e => e.name)).toEqual([ "bench press", "Overhead Press" ]);
    expect(searchExercises("%").map(e => e.name)).toEqual([]);
    expect(searchExercises("").map(e => e.name)).toEqual([
      "bench press",
      "Deadlift",
      "Overhead Press",
      "Romanian Deadlift"
    ]);
  });

  describe("built-in library", () => {
    it("loads about 100 common exercises on first launch", () => {
      loadBuiltInExercises();

      const exercises = listExercises();

      expect(exercises.length).toBeGreaterThanOrEqual(90);
      expect(exercises.length).toBeLessThanOrEqual(110);
      expect(exercises.every(e => e.isBuiltIn)).toBe(true);
      expect(searchExercises("Barbell Back Squat")).toEqual([
        expect.objectContaining({
          name: "Barbell Back Squat",
          muscleGroups: expect.arrayContaining([ "quads", "glutes" ]) as string[],
          equipment: "barbell"
        })
      ]);
    });

    it("has no duplicate names", () => {
      loadBuiltInExercises();

      const names = listExercises().map(e => e.name.toLowerCase());

      expect(new Set(names).size).toBe(names.length);
    });

    it("loads only once, keeping the lifter's edits and deletions", () => {
      loadBuiltInExercises();

      const named = (name: string) => listExercises().find(e => e.name === name);
      const squat = named("Barbell Back Squat")!;
      const bench = named("Barbell Bench Press")!;
      const countBefore = listExercises().length;

      updateExercise(squat.id, { name: "Squat" });
      deleteExercise(bench.id);
      loadBuiltInExercises();

      expect(listExercises()).toHaveLength(countBefore - 1);
      expect(named("Barbell Back Squat")).toBeUndefined();
      expect(named("Barbell Bench Press")).toBeUndefined();
      expect(getExercise(squat.id).name).toBe("Squat");
    });

    it("stays loaded once even after the lifter deletes every built-in", () => {
      loadBuiltInExercises();

      for (const exercise of listExercises()) {
        deleteExercise(exercise.id);
      }

      loadBuiltInExercises();

      expect(listExercises()).toEqual([]);
    });
  });
});
