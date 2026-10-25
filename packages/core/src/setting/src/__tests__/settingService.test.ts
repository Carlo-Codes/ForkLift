import type { Unit } from "@forklift/db/server";
import { setupTestDb } from "@forklift/db/server";
import { ApiError } from "@forklift/debug";

import { getSettings, setUnit } from "..";
import { createExercise } from "../../../exercise/src";
import { createPlan } from "../../../plan/src";
import { createBlock } from "../../../plan/workout/block/src";
import { getExerciseEntry } from "../../../plan/workout/block/exerciseEntry/src";
import { createWorkout } from "../../../plan/workout/src";

describe("settings", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("defaults to kg before the lifter picks a unit", () => {
    const settings = getSettings();

    expect(settings.unit).toBe("kg");
  });

  it("keeps the unit the lifter picks", () => {
    setUnit("lb");

    expect(getSettings().unit).toBe("lb");

    setUnit("kg");

    expect(getSettings().unit).toBe("kg");
  });

  it("rejects a unit other than kg or lb and keeps the current one", () => {
    setUnit("lb");

    expect(() => setUnit("stone" as Unit)).toThrow(expect.objectContaining({
      statusCode: 400,
      type: "ValidationError"
    }) as ApiError);
    expect(getSettings().unit).toBe("lb");
  });

  describe("switching unit", () => {
    let workoutId: string;
    let exerciseId: string;

    const addEntry = (targets: { targetWeight: number; weightStep?: number }) => createBlock(workoutId, {
      exerciseId,
      ...targets
    }).exerciseEntries[ 0 ]!.id;

    const targetsOf = (id: string) => {
      const { targetWeight, weightStep } = getExerciseEntry(id);

      return {
        targetWeight,
        weightStep
      };
    };

    beforeEach(() => {
      ({ id: workoutId } = createWorkout(createPlan({ name: "PPL" }).id, { name: "Push" }));
      ({ id: exerciseId } = createExercise({
        name: "Bench Press",
        muscleGroups: [ "chest" ]
      }));
    });

    it("converts target weights to lb, to the nearest 0.1, and default Weight Steps to 5lb", () => {
      const bench = addEntry({ targetWeight: 100 });
      const fly = addEntry({
        targetWeight: 0,
        weightStep: 1.25
      });

      setUnit("lb");

      expect(targetsOf(bench)).toEqual({
        targetWeight: 220.5,
        weightStep: 5
      });
      expect(targetsOf(fly)).toEqual({
        targetWeight: 0,
        weightStep: 2.8
      });
    });

    it("converts target weights to kg and default Weight Steps to 2.5kg", () => {
      setUnit("lb");

      const bench = addEntry({ targetWeight: 225 });

      setUnit("kg");

      expect(targetsOf(bench)).toEqual({
        targetWeight: 102.1,
        weightStep: 2.5
      });
    });

    it("leaves weights alone when the unit doesn't change", () => {
      const bench = addEntry({ targetWeight: 100 });

      setUnit("kg");

      expect(targetsOf(bench)).toEqual({
        targetWeight: 100,
        weightStep: 2.5
      });
    });
  });
});
