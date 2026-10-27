import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createBlock,
  createSuperset,
  getBlock,
  groupBlocks,
  listBlocks,
  ungroupExerciseEntries
} from "..";
import { createExercise } from "#exercise";
import { createPlan } from "#plan";
import { createWorkout, deleteWorkout } from "#workout";
import {
  deleteExerciseEntries,
  getExerciseEntry,
  reorderExerciseEntries,
  restoreExerciseEntries
} from "#exerciseEntry";
import { listAiChanges, undoAiChange } from "#aiChange";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

// Select mode in the Plan editor: tick rows, then Create Superset, Ungroup or
// Remove them.
describe("Select mode", () => {
  let teardown: () => void;
  let workoutId: string;
  // Exercise ids by name.
  let ids: Record<string, string>;

  // The Workout's Blocks as the Plan editor shows them: each one's Exercise
  // names, in order.
  const layout = () => listBlocks(workoutId).map(b => b.exerciseEntries.map(e => e.exercise.name));
  const add = (name: string, restSeconds?: number) => createBlock(workoutId, {
    exerciseId: ids[ name ]!,
    ...(restSeconds !== undefined && { restSeconds })
  });
  const entryOf = (block: { exerciseEntries: { id: string }[] }, index = 0) => block.exerciseEntries[ index ]!.id;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: workoutId } = createWorkout(createPlan({ name: "PPL" }).id, { name: "Push" }));
    ids = Object.fromEntries([ "Squat", "Bench", "Row", "Dip", "Curl" ].map(name => [
      name,
      createExercise({
        name,
        muscleGroups: [ "chest" ]
      }).id
    ]));
  });

  afterEach(() => teardown());

  describe("Create Superset", () => {
    it("groups rows that aren't next to each other at the top-most one's place, keeping their order", () => {
      const squat = add("Squat");

      add("Bench");

      const row = add("Row");

      add("Dip");

      const curl = add("Curl");

      const superset = createSuperset(workoutId, { exerciseEntryIds: [ entryOf(curl), entryOf(squat), entryOf(row) ] });

      expect(superset.exerciseEntries.map(e => e.exercise.name)).toEqual([ "Squat", "Row", "Curl" ]);
      expect(superset.exerciseEntries.map(e => e.id)).toEqual([ entryOf(squat), entryOf(row), entryOf(curl) ]);
      expect(layout()).toEqual([ [ "Squat", "Row", "Curl" ], [ "Bench" ], [ "Dip" ] ]);
      expect(listBlocks(workoutId).map(b => b.position)).toEqual([ 0, 1, 2 ]);
    });

    it("groups whole Blocks by id", () => {
      add("Squat");

      const bench = add("Bench");

      add("Row");

      const dip = add("Dip");

      createSuperset(workoutId, { blockIds: [ bench.id, dip.id ] });

      expect(layout()).toEqual([ [ "Squat" ], [ "Bench", "Dip" ], [ "Row" ] ]);
    });

    it("adds the other ticked rows to a ticked Superset, which keeps its id", () => {
      const squat = add("Squat");
      const superset = groupBlocks(workoutId, [ add("Bench").id, add("Row").id ]);

      add("Dip");

      const curl = add("Curl");

      const grown = createSuperset(workoutId, {
        blockIds: [ superset.id ],
        exerciseEntryIds: [ entryOf(curl), entryOf(squat) ]
      });

      expect(grown.id).toBe(superset.id);
      expect(layout()).toEqual([ [ "Squat", "Bench", "Row", "Curl" ], [ "Dip" ] ]);
    });

    it("takes ticked entries out of a Superset, leaving the rest of it in place", () => {
      add("Squat");

      const superset = groupBlocks(workoutId, [ add("Bench").id, add("Row").id, add("Dip").id ]);
      const curl = add("Curl");

      createSuperset(workoutId, { exerciseEntryIds: [ entryOf(superset, 1), entryOf(curl) ] });

      expect(layout()).toEqual([ [ "Squat" ], [ "Bench", "Dip" ], [ "Row", "Curl" ] ]);
    });

    it("needs two or more rows from this Workout", () => {
      const squat = add("Squat");
      const bench = add("Bench");
      const elsewhere = createBlock(createWorkout(createPlan({ name: "Other" }).id, { name: "Pull" }).id, { exerciseId: ids.Row! });

      expect(() => createSuperset(workoutId, { exerciseEntryIds: [ entryOf(squat) ] })).toThrow(validationError);
      expect(() => createSuperset(workoutId, { exerciseEntryIds: [ entryOf(squat), entryOf(squat) ] })).toThrow(validationError);
      expect(() => createSuperset(workoutId, { exerciseEntryIds: [ entryOf(squat), entryOf(elsewhere) ] })).toThrow(validationError);
      expect(() => createSuperset(workoutId, { blockIds: [ bench.id, elsewhere.id ] })).toThrow(validationError);
      expect(() => createSuperset(workoutId, { exerciseEntryIds: [ "not-a-uuid", entryOf(squat) ] })).toThrow(validationError);
      expect(layout()).toEqual([ [ "Squat" ], [ "Bench" ] ]);
    });

    it("refuses a Workout that isn't there", () => {
      const squat = add("Squat");
      const bench = add("Bench");

      deleteWorkout(workoutId);

      expect(() => createSuperset(workoutId, { blockIds: [ squat.id, bench.id ] })).toThrow(notFoundError);
    });
  });

  describe("Ungroup", () => {
    it("takes the ticked entries out of their Superset, just after it", () => {
      const superset = groupBlocks(workoutId, [ add("Squat").id, add("Bench").id, add("Row").id ]);

      add("Dip");

      ungroupExerciseEntries(workoutId, [ entryOf(superset, 1) ]);

      expect(layout()).toEqual([ [ "Squat", "Row" ], [ "Bench" ], [ "Dip" ] ]);
      expect(getBlock(superset.id).exerciseEntries.map(e => e.exercise.name)).toEqual([ "Squat", "Row" ]);
    });

    it("splits a Superset whose entries are all ticked, leaving straight sets alone", () => {
      const curl = add("Curl");
      const superset = groupBlocks(workoutId, [ add("Squat").id, add("Bench").id ]);

      ungroupExerciseEntries(workoutId, [ entryOf(curl), ...superset.exerciseEntries.map(e => e.id) ]);

      expect(layout()).toEqual([ [ "Curl" ], [ "Squat" ], [ "Bench" ] ]);
      expect(listBlocks(workoutId)[ 1 ]!.id).toBe(superset.id);
      expect(listBlocks(workoutId).map(b => b.position)).toEqual([ 0, 1, 2 ]);
    });

    it("refuses entries that aren't in this Workout", () => {
      add("Squat");

      expect(() => ungroupExerciseEntries(workoutId, [ crypto.randomUUID() ])).toThrow(validationError);
      expect(() => ungroupExerciseEntries(workoutId, [])).toThrow(validationError);
    });
  });

  describe("Remove, with Undo", () => {
    it("removes several rows at once and Undo puts them all back in place", () => {
      const squat = add("Squat");
      const superset = groupBlocks(workoutId, [ add("Bench").id, add("Row").id, add("Dip").id ]);
      const curl = add("Curl");
      const before = layout();

      const removal = deleteExerciseEntries([ entryOf(squat), entryOf(superset, 0), entryOf(superset, 1), entryOf(curl) ]);

      expect(layout()).toEqual([ [ "Dip" ] ]);

      restoreExerciseEntries(removal);

      expect(layout()).toEqual(before);
      expect(listBlocks(workoutId).map(b => b.position)).toEqual([ 0, 1, 2 ]);
      expect(getBlock(superset.id).exerciseEntries.map(e => e.position)).toEqual([ 0, 1, 2 ]);
    });

    it("brings back a whole Superset removed row by row", () => {
      add("Squat");

      const superset = groupBlocks(workoutId, [ add("Bench").id, add("Row").id ]);

      restoreExerciseEntries(deleteExerciseEntries(superset.exerciseEntries.map(e => e.id)));

      expect(layout()).toEqual([ [ "Squat" ], [ "Bench", "Row" ] ]);
    });

    it("removes nothing when one of the rows isn't there", () => {
      const squat = add("Squat");

      expect(() => deleteExerciseEntries([ entryOf(squat), crypto.randomUUID() ])).toThrow(notFoundError);
      expect(getExerciseEntry(entryOf(squat)).deletedAt).toBeNull();
    });

    it("keeps positions unique when the Superset changed while Undo showed", () => {
      const superset = groupBlocks(workoutId, [ add("Bench").id, add("Row").id, add("Dip").id ]);
      const [ bench, row, dip ] = superset.exerciseEntries;
      const removal = deleteExerciseEntries([ bench!.id, row!.id ]);

      reorderExerciseEntries(superset.id, [ dip!.id ]);
      restoreExerciseEntries(removal);

      const restored = getBlock(superset.id).exerciseEntries;

      expect(restored.map(e => e.exercise.name).toSorted()).toEqual([ "Bench", "Dip", "Row" ]);
      expect(restored.map(e => e.position)).toEqual([ 0, 1, 2 ]);
    });
  });

  describe("AI Access", () => {
    it("still groups only neighbouring Blocks through groupBlocks, and Undo of the Change by AI splits them again", () => {
      const squat = add("Squat");

      add("Bench");

      const row = add("Row");

      expect(() => groupBlocks(workoutId, [ squat.id, row.id ], "ai")).toThrow(validationError);

      groupBlocks(workoutId, [ squat.id, listBlocks(workoutId)[ 1 ]!.id ], "ai");

      expect(layout()).toEqual([ [ "Squat", "Bench" ], [ "Row" ] ]);

      const [ change ] = listAiChanges();

      expect(change!.summary).toBe("Made a Superset of Squat + Bench in Workout \"Push\"");

      undoAiChange(change!.id);

      expect(layout()).toEqual([ [ "Squat" ], [ "Bench" ], [ "Row" ] ]);
    });
  });
});
