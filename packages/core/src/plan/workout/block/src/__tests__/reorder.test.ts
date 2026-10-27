import { jest } from "@jest/globals";

import { setupTestDb } from "@forklift/db/server";

import {
  createBlock, deleteBlock, getBlock, groupBlocks, listBlocks, reorderBlocks
} from "..";
import { listAiChanges, undoAiChange } from "#aiChange";
import { createExercise } from "#exercise";
import { reorderExerciseEntries } from "#exerciseEntry";
import { createPlan } from "#plan";
import {
  createWorkout, listWorkouts, reorderWorkouts
} from "#workout";

const CREATED = new Date("2026-10-27T09:00:00Z");
const DRAGGED = new Date("2026-10-27T09:05:00Z");

// What a drag in the Plan editor saves: Blocks in a Workout, Exercise Entries
// in a Superset and Workouts in a Plan, each a full new order.
describe("reordering by drag", () => {
  let teardown: () => void;
  let planId: string;
  let workoutId: string;
  let exerciseIds: string[];

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    jest.useFakeTimers({ now: CREATED });
    ({ id: planId } = createPlan({ name: "PPL" }));
    ({ id: workoutId } = createWorkout(planId, { name: "Push" }));
    exerciseIds = [
      "Bench Press",
      "Barbell Row",
      "Squat",
      "Dip"
    ].map(name => createExercise({
      name,
      muscleGroups: [ "chest" ]
    }).id);
  });

  afterEach(() => {
    jest.useRealTimers();
    teardown();
  });

  // Blocks of straight sets, one per Exercise, in order.
  const addBlocks = (count: number) => exerciseIds.slice(0, count).map(exerciseId => createBlock(workoutId, { exerciseId }).id);

  const blockRows = () => listBlocks(workoutId).map(b => ({
    id: b.id,
    position: b.position,
    updatedAt: b.updatedAt
  }));

  describe("Blocks in a Workout", () => {
    it("moves a Block, numbering the Blocks 0..n-1 and writing only those that moved", () => {
      const [ a, b, c, d ] = addBlocks(4);

      jest.setSystemTime(DRAGGED);
      // c dragged up to second place.
      reorderBlocks(workoutId, [ a!, c!, b!, d! ]);

      expect(blockRows()).toEqual([
        {
          id: a,
          position: 0,
          updatedAt: CREATED
        },
        {
          id: c,
          position: 1,
          updatedAt: DRAGGED
        },
        {
          id: b,
          position: 2,
          updatedAt: DRAGGED
        },
        {
          id: d,
          position: 3,
          updatedAt: CREATED
        }
      ]);
    });

    it("writes nothing when the order is the same", () => {
      const ids = addBlocks(3);
      const before = blockRows();

      jest.setSystemTime(DRAGGED);
      reorderBlocks(workoutId, ids);

      expect(blockRows()).toEqual(before);
    });

    it("closes the gap a removed Block left", () => {
      const [ a, b, c ] = addBlocks(3);

      deleteBlock(b!);
      reorderBlocks(workoutId, [ c!, a! ]);

      expect(blockRows().map(r => r.position)).toEqual([ 0, 1 ]);
      expect(blockRows().map(r => r.id)).toEqual([ c, a ]);
    });

    it("writes nothing for an order that leaves out or repeats a Block", () => {
      const [ , b ] = addBlocks(2);
      const before = blockRows();

      jest.setSystemTime(DRAGGED);

      expect(() => reorderBlocks(workoutId, [ b!, b! ])).toThrow(expect.objectContaining({ type: "ValidationError" }) as Error);
      expect(() => reorderBlocks(workoutId, [ b! ])).toThrow(expect.objectContaining({ type: "ValidationError" }) as Error);
      expect(blockRows()).toEqual(before);
    });
  });

  describe("Exercise Entries in a Superset", () => {
    it("moves an entry within its Superset, writing only those that moved", () => {
      const superset = groupBlocks(workoutId, addBlocks(3));
      const [ a, b, c ] = superset.exerciseEntries.map(e => e.id);

      jest.setSystemTime(DRAGGED);
      reorderExerciseEntries(superset.id, [ c!, a!, b! ]);

      expect(getBlock(superset.id).exerciseEntries.map(e => ({
        id: e.id,
        position: e.position
      }))).toEqual([
        {
          id: c,
          position: 0
        },
        {
          id: a,
          position: 1
        },
        {
          id: b,
          position: 2
        }
      ]);

      jest.setSystemTime(new Date("2026-10-27T09:10:00Z"));
      reorderExerciseEntries(superset.id, [ c!, a!, b! ]);

      expect(getBlock(superset.id).exerciseEntries.map(e => e.updatedAt)).toEqual([
        DRAGGED,
        DRAGGED,
        DRAGGED
      ]);
    });
  });

  describe("Workouts in a Plan", () => {
    it("moves a Workout tab, writing only those that moved", () => {
      const push = workoutId;
      const pull = createWorkout(planId, { name: "Pull" }).id;
      const legs = createWorkout(planId, { name: "Legs" }).id;
      const workouts = () => listWorkouts(planId).map(w => ({
        id: w.id,
        position: w.position,
        updatedAt: w.updatedAt
      }));

      jest.setSystemTime(DRAGGED);
      reorderWorkouts(planId, [ push, legs, pull ]);

      expect(workouts()).toEqual([
        {
          id: push,
          position: 0,
          updatedAt: CREATED
        },
        {
          id: legs,
          position: 1,
          updatedAt: DRAGGED
        },
        {
          id: pull,
          position: 2,
          updatedAt: DRAGGED
        }
      ]);

      const before = workouts();

      reorderWorkouts(planId, [ push, legs, pull ]);

      expect(workouts()).toEqual(before);
    });
  });

  // AI Access's reorder_blocks, reorder_superset and reorder_workouts tools
  // call these Services as the AI: what they record and undo stays the same.
  describe("as the AI", () => {
    it("records a Block reorder with just the moved rows, and undoes it", () => {
      const [ a, b, c ] = addBlocks(3);

      reorderBlocks(workoutId, [ b!, a!, c! ], "ai");

      const [ change ] = listAiChanges();

      expect(change).toEqual(expect.objectContaining({
        summary: "Reordered Workout \"Push\"",
        rows: [
          {
            table: "block",
            id: a,
            before: { position: 0 },
            after: { position: 1 }
          },
          {
            table: "block",
            id: b,
            before: { position: 1 },
            after: { position: 0 }
          }
        ]
      }));

      undoAiChange(change!.id);

      expect(blockRows().map(r => r.id)).toEqual([ a, b, c ]);
    });

    it("records a Superset reorder, and undoes it", () => {
      const superset = groupBlocks(workoutId, addBlocks(2));
      const [ a, b ] = superset.exerciseEntries.map(e => e.id);

      reorderExerciseEntries(superset.id, [ b!, a! ], "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([ "Reordered a Superset in Workout \"Push\"" ]);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(getBlock(superset.id).exerciseEntries.map(e => e.id)).toEqual([ a, b ]);
    });

    it("records a Workout reorder, and undoes it", () => {
      const pull = createWorkout(planId, { name: "Pull" }).id;

      reorderWorkouts(planId, [ pull, workoutId ], "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([ "Reordered the Workouts of Plan \"PPL\"" ]);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(listWorkouts(planId).map(w => w.id)).toEqual([ workoutId, pull ]);
    });

    it("records nothing for an order that's the same", () => {
      const ids = addBlocks(2);
      const superset = groupBlocks(workoutId, ids);

      reorderBlocks(workoutId, listBlocks(workoutId).map(b => b.id), "ai");
      reorderExerciseEntries(superset.id, superset.exerciseEntries.map(e => e.id), "ai");
      reorderWorkouts(planId, [ workoutId ], "ai");

      expect(listAiChanges()).toEqual([]);
    });
  });
});
