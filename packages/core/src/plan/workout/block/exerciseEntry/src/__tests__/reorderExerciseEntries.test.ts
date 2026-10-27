import { jest } from "@jest/globals";

import { setupTestDb } from "@forklift/db/server";

import { reorderExerciseEntries } from "..";
import { listAiChanges, undoAiChange } from "#aiChange";
import {
  createBlock, getBlock, groupBlocks
} from "#block";
import type { BlockWithEntries } from "#block";
import { createExercise } from "#exercise";
import { createPlan } from "#plan";
import { createWorkout } from "#workout";

const CREATED = new Date("2026-10-27T09:00:00Z");
const DRAGGED = new Date("2026-10-27T09:05:00Z");

// Dragging an Exercise Entry within its Superset in the Plan editor saves the
// Superset's entries in their new order.
describe("reordering a Superset's Exercise Entries", () => {
  let teardown: () => void;
  let superset: BlockWithEntries;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    jest.useFakeTimers({ now: CREATED });

    const { id: workoutId } = createWorkout(createPlan({ name: "PPL" }).id, { name: "Push" });

    superset = groupBlocks(workoutId, [
      "Bench Press",
      "Barbell Row",
      "Squat"
    ].map(name => createBlock(workoutId, {
      exerciseId: createExercise({
        name,
        muscleGroups: [ "chest" ]
      }).id
    }).id));
  });

  afterEach(() => {
    jest.useRealTimers();
    teardown();
  });

  const entryRows = () => getBlock(superset.id).exerciseEntries.map(e => ({
    id: e.id,
    position: e.position,
    updatedAt: e.updatedAt
  }));

  it("moves an entry within its Superset, writing only those that moved", () => {
    const [ a, b, c ] = superset.exerciseEntries.map(e => e.id);

    jest.setSystemTime(DRAGGED);
    // b dragged down to the end.
    reorderExerciseEntries(superset.id, [ a!, c!, b! ]);

    expect(entryRows()).toEqual([
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
      }
    ]);
  });

  it("writes nothing when the order is the same", () => {
    const before = entryRows();

    jest.setSystemTime(DRAGGED);
    reorderExerciseEntries(superset.id, superset.exerciseEntries.map(e => e.id));

    expect(entryRows()).toEqual(before);
  });

  // AI Access's reorder_superset tool calls reorderExerciseEntries as the AI:
  // what it records and undoes stays the same.
  describe("as the AI", () => {
    it("records the reorder, and undoes it", () => {
      const ids = superset.exerciseEntries.map(e => e.id);

      reorderExerciseEntries(superset.id, ids.toReversed(), "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([ "Reordered a Superset in Workout \"Push\"" ]);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(entryRows().map(e => e.id)).toEqual(ids);
    });

    it("records nothing for an order that's the same", () => {
      reorderExerciseEntries(superset.id, superset.exerciseEntries.map(e => e.id), "ai");

      expect(listAiChanges()).toEqual([]);
    });
  });
});
