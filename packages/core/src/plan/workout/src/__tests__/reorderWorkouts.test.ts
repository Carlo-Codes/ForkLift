import { jest } from "@jest/globals";

import { setupTestDb } from "@forklift/db/server";

import {
  createWorkout, listWorkouts, reorderWorkouts
} from "..";
import { listAiChanges, undoAiChange } from "#aiChange";
import { createPlan } from "#plan";

const CREATED = new Date("2026-10-27T09:00:00Z");
const DRAGGED = new Date("2026-10-27T09:05:00Z");

// Dragging a Workout tab in the Plan editor saves the Plan's Workouts in
// their new order.
describe("reordering a Plan's Workouts", () => {
  let teardown: () => void;
  let planId: string;
  let push: string;
  let pull: string;
  let legs: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    jest.useFakeTimers({ now: CREATED });
    ({ id: planId } = createPlan({ name: "PPL" }));
    [ push, pull, legs ] = [
      "Push",
      "Pull",
      "Legs"
    ].map(name => createWorkout(planId, { name }).id) as [string, string, string];
  });

  afterEach(() => {
    jest.useRealTimers();
    teardown();
  });

  const workoutRows = () => listWorkouts(planId).map(w => ({
    id: w.id,
    position: w.position,
    updatedAt: w.updatedAt
  }));

  it("moves a Workout, writing only those that moved", () => {
    jest.setSystemTime(DRAGGED);
    // Legs dragged left of Pull.
    reorderWorkouts(planId, [ push, legs, pull ]);

    expect(workoutRows()).toEqual([
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
  });

  it("writes nothing when the order is the same", () => {
    const before = workoutRows();

    jest.setSystemTime(DRAGGED);
    reorderWorkouts(planId, [ push, pull, legs ]);

    expect(workoutRows()).toEqual(before);
  });

  // AI Access's reorder_workouts tool calls reorderWorkouts as the AI: what it
  // records and undoes stays the same.
  describe("as the AI", () => {
    it("records the reorder, and undoes it", () => {
      reorderWorkouts(planId, [ pull, push, legs ], "ai");

      expect(listAiChanges().map(c => c.summary)).toEqual([ "Reordered the Workouts of Plan \"PPL\"" ]);

      undoAiChange(listAiChanges()[ 0 ]!.id);

      expect(workoutRows().map(w => w.id)).toEqual([ push, pull, legs ]);
    });

    it("records nothing for an order that's the same", () => {
      reorderWorkouts(planId, [ push, pull, legs ], "ai");

      expect(listAiChanges()).toEqual([]);
    });
  });
});
