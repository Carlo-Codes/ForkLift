import { jest } from "@jest/globals";

import { setupTestDb } from "@forklift/db/server";

import {
  createBlock, deleteBlock, listBlocks, reorderBlocks
} from "..";
import { listAiChanges, undoAiChange } from "#aiChange";
import { createExercise } from "#exercise";
import { createPlan } from "#plan";
import { createWorkout } from "#workout";

const CREATED = new Date("2026-10-27T09:00:00Z");
const DRAGGED = new Date("2026-10-27T09:05:00Z");

// Dragging a Block, a row or a whole Superset, in the Plan editor saves the
// Workout's Blocks in their new order.
describe("reordering a Workout's Blocks", () => {
  let teardown: () => void;
  let workoutId: string;
  let exerciseIds: string[];

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    jest.useFakeTimers({ now: CREATED });
    ({ id: workoutId } = createWorkout(createPlan({ name: "PPL" }).id, { name: "Push" }));
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

  // AI Access's reorder_blocks tool calls reorderBlocks as the AI: what it
  // records and undoes stays the same.
  describe("as the AI", () => {
    it("records just the moved Blocks, and undoes them", () => {
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

    it("records nothing for an order that's the same", () => {
      reorderBlocks(workoutId, addBlocks(2), "ai");

      expect(listAiChanges()).toEqual([]);
    });
  });
});
