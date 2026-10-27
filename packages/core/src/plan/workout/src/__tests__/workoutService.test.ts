import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createNextDayWorkout,
  createWorkout,
  deleteWorkout,
  getWorkout,
  listWorkouts,
  reorderWorkouts,
  updateWorkout
} from "..";
import {
  createPlan, deletePlan, getActivePlan, listPlans, setActivePlan
} from "#plan";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("workouts", () => {
  let teardown: () => void;
  let planId: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: planId } = createPlan({ name: "PPL" }));
  });

  afterEach(() => teardown());

  it("lists a Plan's Workouts in the order the lifter adds them", () => {
    createWorkout(planId, { name: "Push" });
    createWorkout(planId, { name: "Pull" });
    createWorkout(createPlan({ name: "Other" }).id, { name: "Full Body" });

    expect(listWorkouts(planId).map(w => w.name)).toEqual([ "Push", "Pull" ]);
  });

  it("names a Workout added with \"+\" after its place in the Plan", () => {
    createWorkout(planId, { name: "Push" });
    createWorkout(planId, { name: "Pull" });

    expect(createNextDayWorkout(planId).name).toBe("Day 3");
    expect(createNextDayWorkout(planId).name).toBe("Day 4");
    expect(listWorkouts(planId).map(w => w.name)).toEqual([
      "Push",
      "Pull",
      "Day 3",
      "Day 4"
    ]);
  });

  it("skips a \"Day N\" name the Plan already has", () => {
    createWorkout(planId, { name: "Day 2" });

    expect(createNextDayWorkout(planId).name).toBe("Day 3");
    expect(createNextDayWorkout(planId).name).toBe("Day 4");
  });

  it("renames a Workout and rejects an empty name", () => {
    const { id } = createWorkout(planId, { name: "Push" });

    updateWorkout(id, { name: "Push day" });

    expect(() => updateWorkout(id, { name: "  " })).toThrow(validationError);
    expect(() => createWorkout(planId, { name: "" })).toThrow(validationError);
    expect(getWorkout(id).name).toBe("Push day");
  });

  it("refuses a Workout for a missing Plan", () => {
    expect(() => createWorkout(crypto.randomUUID(), { name: "Push" })).toThrow(notFoundError);
    expect(() => listWorkouts(crypto.randomUUID())).toThrow(notFoundError);
  });

  it("reorders a Plan's Workouts", () => {
    const push = createWorkout(planId, { name: "Push" });
    const pull = createWorkout(planId, { name: "Pull" });
    const legs = createWorkout(planId, { name: "Legs" });

    reorderWorkouts(planId, [
      legs.id,
      push.id,
      pull.id
    ]);

    expect(listWorkouts(planId).map(w => w.name)).toEqual([
      "Legs",
      "Push",
      "Pull"
    ]);
    expect(() => reorderWorkouts(planId, [ legs.id, push.id ])).toThrow(validationError);
  });

  it("hides a deleted Workout and adds the next one at the end", () => {
    const push = createWorkout(planId, { name: "Push" });

    createWorkout(planId, { name: "Pull" });
    deleteWorkout(push.id);
    createWorkout(planId, { name: "Legs" });

    expect(listWorkouts(planId).map(w => w.name)).toEqual([ "Pull", "Legs" ]);
    expect(() => getWorkout(push.id)).toThrow(notFoundError);
    expect(() => deleteWorkout(push.id)).toThrow(notFoundError);
  });

  it("deletes a Plan with its Workouts, and it stops being Active", () => {
    const push = createWorkout(planId, { name: "Push" });

    setActivePlan(planId);
    deletePlan(planId);

    expect(listPlans()).toEqual([]);
    expect(getActivePlan()).toBeUndefined();
    expect(() => getWorkout(push.id)).toThrow(notFoundError);
    expect(() => deletePlan(planId)).toThrow(notFoundError);
  });
});
