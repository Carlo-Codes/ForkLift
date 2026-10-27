import { jest } from "@jest/globals";

import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createPlan,
  getActivePlan,
  getPlan,
  deletePlan,
  listPlanCards,
  listPlans,
  planDateRow,
  setActivePlan,
  setPlanStart,
  setPlanWeeks,
  updatePlan
} from "..";
import { listBlocks } from "#block";
import {
  createPlanWithWorkouts, createWorkout, deleteWorkout, listWorkouts, newPlanDefaults, newPlanWorkoutNames
} from "#workout";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("plans", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("lists Plans newest first, none Active", () => {
    createPlan({ name: "Push / Pull / Legs" });
    createPlan({ name: "  Upper / Lower " });

    expect(listPlans()).toEqual([
      expect.objectContaining({
        name: "Upper / Lower",
        isActive: false
      }),
      expect.objectContaining({
        name: "Push / Pull / Legs",
        isActive: false
      })
    ]);
  });

  it("lists Plans created in the same millisecond latest added first", () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T09:00:00Z") });

    try {
      createPlan({ name: "A" });
      createPlan({ name: "B" });
      createPlan({ name: "C" });

      expect(listPlans().map(p => p.name)).toEqual([
        "C",
        "B",
        "A"
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  describe("a Plan made with the New plan form", () => {
    const form = {
      name: "PPL",
      startDate: "2026-10-27",
      weeks: 8,
      workoutCount: 3
    };

    it("defaults to today, 8 weeks and Push, Pull and Legs", () => {
      expect(newPlanDefaults(new Date(2026, 9, 27, 23, 30))).toEqual({
        name: "",
        startDate: "2026-10-27",
        weeks: 8,
        workoutCount: 3
      });
      expect(newPlanWorkoutNames(3)).toEqual([
        "Push",
        "Pull",
        "Legs"
      ]);
    });

    it("runs from the start date to the last day of its last week", () => {
      const plan = createPlanWithWorkouts(form);

      expect(plan).toEqual(expect.objectContaining({
        name: "PPL",
        startDate: "2026-10-27",
        endDate: "2026-12-21",
        isActive: false
      }));
    });

    it.each([
      [ 1, [ "Full Body" ] ],
      [ 2, [ "Upper", "Lower" ] ],
      [ 3, [ "Push", "Pull", "Legs" ] ],
      [ 4, [ "Upper", "Lower", "Upper", "Lower" ] ],
      [ 5, [ "Push", "Pull", "Legs", "Upper", "Lower" ] ],
      [ 6, [ "Push", "Pull", "Legs", "Push", "Pull", "Legs" ] ]
    ])("with %i Workouts names them %j, empty and in order", (workoutCount, names) => {
      const plan = createPlanWithWorkouts({
        ...form,
        workoutCount
      });
      const workouts = listWorkouts(plan.id);

      expect(workouts.map(w => w.name)).toEqual(names);
      expect(workouts.flatMap(w => listBlocks(w.id))).toEqual([]);
    });

    it.each([
      [ "no name", { name: " " } ],
      [ "no start date", { startDate: "" } ],
      [ "no weeks", { weeks: 0 } ],
      [ "part weeks", { weeks: 1.5 } ],
      [ "too many weeks", { weeks: 53 } ],
      [ "no Workouts", { workoutCount: 0 } ],
      [ "too many Workouts", { workoutCount: 7 } ]
    ])("adds neither the Plan nor its Workouts with %s", (_, change) => {
      expect(() => createPlanWithWorkouts({
        ...form,
        ...change
      })).toThrow(validationError);
      expect(listPlans()).toEqual([]);
    });
  });

  it("rejects a Plan without a name and adds nothing", () => {
    expect(() => createPlan({ name: " " })).toThrow(validationError);
    expect(listPlans()).toEqual([]);
  });

  it("renames a Plan and rejects an empty name", () => {
    const { id } = createPlan({ name: "PPL" });

    updatePlan(id, { name: "Push / Pull / Legs" });

    expect(() => updatePlan(id, { name: "" })).toThrow(validationError);
    expect(getPlan(id).name).toBe("Push / Pull / Legs");
  });

  it("reports a missing Plan as not found", () => {
    const missingId = crypto.randomUUID();

    expect(() => getPlan(missingId)).toThrow(notFoundError);
    expect(() => updatePlan(missingId, { name: "PPL" })).toThrow(notFoundError);
  });

  describe("From and To dates", () => {
    it("has no dates unless the lifter sets them", () => {
      expect(createPlan({ name: "PPL" })).toEqual(expect.objectContaining({
        startDate: null,
        endDate: null
      }));
    });

    it("saves a Plan's dates as calendar days", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      expect(getPlan(id)).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
    });

    it("allows a Plan to start and end on the same day, or set only one date", () => {
      expect(createPlan({
        name: "A",
        startDate: "2026-11-02",
        endDate: "2026-11-02"
      }).endDate).toBe("2026-11-02");
      expect(createPlan({
        name: "B",
        endDate: "2026-11-02"
      }).startDate).toBeNull();
    });

    it("rejects a To date before the From date and adds nothing", () => {
      expect(() => createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-11-01"
      })).toThrow(validationError);
      expect(listPlans()).toEqual([]);
    });

    it("rejects a date that isn't a calendar day", () => {
      for (const date of [
        "2026-02-30",
        "02/11/2026",
        "2026-11-02T00:00:00Z",
        ""
      ]) {
        expect(() => createPlan({
          name: "PPL",
          startDate: date
        })).toThrow(validationError);
      }
    });

    it("changes one date, keeps the other, and clears one set to null", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      updatePlan(id, { endDate: "2027-01-03" });

      expect(getPlan(id)).toEqual(expect.objectContaining({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2027-01-03"
      }));

      updatePlan(id, { startDate: null });

      expect(getPlan(id).startDate).toBeNull();
      expect(getPlan(id).endDate).toBe("2027-01-03");
    });

    it("rejects an edit that puts To before the From date already saved", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      expect(() => updatePlan(id, { endDate: "2026-11-01" })).toThrow(validationError);
      expect(() => updatePlan(id, { startDate: "2026-12-28" })).toThrow(validationError);
      expect(getPlan(id)).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
    });

    it("doesn't change which Plan is Active", () => {
      const current = createPlan({ name: "Current" });
      const ended = createPlan({
        name: "Ended",
        startDate: "2020-01-01",
        endDate: "2020-02-01"
      });
      const upcoming = createPlan({
        name: "Upcoming",
        startDate: "2099-01-01"
      });

      setActivePlan(ended.id);
      updatePlan(upcoming.id, { startDate: "2000-01-01" });
      updatePlan(current.id, {
        startDate: "2000-01-01",
        endDate: "2099-01-01"
      });

      expect(getActivePlan()?.id).toBe(ended.id);
    });
  });

  describe("start date and weeks", () => {
    const dated = () => createPlan({
      name: "PPL",
      startDate: "2026-10-27",
      endDate: "2026-12-21"
    });

    it("reads From and To as a start date and the weeks they cover", () => {
      expect(planDateRow(dated())).toEqual({
        startDate: "2026-10-27",
        weeks: 8,
        endDate: "2026-12-21"
      });
    });

    it("reads a To that isn't a whole number of weeks after From rounded up, and leaves it alone", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-10-27",
        endDate: "2026-11-03"
      }, "ai");

      expect(planDateRow(getPlan(id)).weeks).toBe(2);
      expect(getPlan(id).endDate).toBe("2026-11-03");
    });

    it("has no weeks without both dates", () => {
      expect(planDateRow(createPlan({ name: "A" })).weeks).toBeNull();
      expect(planDateRow(createPlan({
        name: "B",
        startDate: "2026-10-27"
      })).weeks).toBeNull();
    });

    it("moves To with a new start date, keeping the weeks", () => {
      const { id } = dated();

      expect(setPlanStart(id, "2026-11-02")).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
    });

    it("keeps the rounded-up weeks of an uneven To when the start date moves", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-10-27",
        endDate: "2026-11-03"
      });

      expect(setPlanStart(id, "2026-11-02").endDate).toBe("2026-11-15");
    });

    it("gives a Plan without weeks the New plan form's 8 when its start date is set", () => {
      for (const dates of [
        {},
        { startDate: "2026-10-01" },
        { endDate: "2026-10-01" }
      ]) {
        const { id } = createPlan({
          name: "PPL",
          ...dates
        });

        expect(setPlanStart(id, "2026-10-27")).toEqual(expect.objectContaining({
          startDate: "2026-10-27",
          endDate: "2026-12-21"
        }));
      }
    });

    it("moves To with the weeks", () => {
      const { id } = dated();

      expect(setPlanWeeks(id, 1).endDate).toBe("2026-11-02");
      expect(setPlanWeeks(id, 52).endDate).toBe("2027-10-25");
      expect(getPlan(id).startDate).toBe("2026-10-27");
    });

    it("rejects weeks outside 1 to 52 or not whole, and weeks without a start date", () => {
      const { id } = dated();

      for (const weeks of [
        0,
        53,
        1.5,
        Number.NaN
      ]) {
        expect(() => setPlanWeeks(id, weeks)).toThrow(validationError);
      }

      expect(getPlan(id).endDate).toBe("2026-12-21");

      const undated = createPlan({ name: "Undated" });

      expect(() => setPlanWeeks(undated.id, 4)).toThrow(validationError);
      expect(getPlan(undated.id).endDate).toBeNull();
    });

    it("lets the lifter shorten a Plan the AI made longer than 52 weeks a week at a time", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-10-27",
        endDate: "2027-12-20"
      }, "ai");

      expect(planDateRow(getPlan(id)).weeks).toBe(60);
      expect(() => setPlanWeeks(id, 61)).toThrow(validationError);
      expect(setPlanWeeks(id, 59).endDate).toBe("2027-12-13");
      expect(() => setPlanWeeks(id, 60)).toThrow(validationError);
    });

    it("rejects a start date that isn't a calendar day", () => {
      const { id } = dated();

      for (const day of [
        "2026-02-30",
        "02/11/2026"
      ]) {
        expect(() => setPlanStart(id, day)).toThrow(validationError);
      }

      expect(getPlan(id).startDate).toBe("2026-10-27");
    });

    it("clears both dates with the start date", () => {
      const { id } = dated();

      expect(setPlanStart(id, null)).toEqual(expect.objectContaining({
        startDate: null,
        endDate: null
      }));
    });

    it("reports a missing Plan as not found", () => {
      const missingId = crypto.randomUUID();

      expect(() => setPlanStart(missingId, "2026-10-27")).toThrow(notFoundError);
      expect(() => setPlanWeeks(missingId, 4)).toThrow(notFoundError);
    });
  });

  describe("Active Plan", () => {
    it("has no Active Plan until the lifter picks one", () => {
      createPlan({ name: "PPL" });

      expect(getActivePlan()).toBeUndefined();
    });

    it("keeps at most one Plan Active", () => {
      const ppl = createPlan({ name: "PPL" });
      const upperLower = createPlan({ name: "Upper / Lower" });

      setActivePlan(ppl.id);

      expect(getActivePlan()?.id).toBe(ppl.id);

      setActivePlan(upperLower.id);

      expect(getActivePlan()?.id).toBe(upperLower.id);
      expect(listPlans().filter(p => p.isActive)
        .map(p => p.id)).toEqual([ upperLower.id ]);
    });

    it("can be cleared", () => {
      const ppl = createPlan({ name: "PPL" });

      setActivePlan(ppl.id);
      setActivePlan(null);

      expect(getActivePlan()).toBeUndefined();
    });

    it("refuses a missing Plan and keeps the current one", () => {
      const ppl = createPlan({ name: "PPL" });

      setActivePlan(ppl.id);

      expect(() => setActivePlan(crypto.randomUUID())).toThrow(notFoundError);
      expect(getActivePlan()?.id).toBe(ppl.id);
    });
  });

  describe("Plans list cards", () => {
    it("shows each Plan newest first with its dates, Active badge and live Workout names in order", () => {
      const ppl = createPlan({ name: "PPL" });
      const push = createWorkout(ppl.id, { name: "Push" });

      createWorkout(ppl.id, { name: "Pull" });
      deleteWorkout(push.id);
      createWorkout(ppl.id, { name: "Legs" });
      setActivePlan(ppl.id);
      const block = createPlan({
        name: "Strength block",
        startDate: "2026-11-02",
        endDate: "2026-12-20"
      });

      expect(listPlanCards("2026-10-27")).toEqual([
        {
          id: block.id,
          name: "Strength block",
          startDate: "2026-11-02",
          endDate: "2026-12-20",
          isActive: false,
          progress: {
            planWeek: {
              status: "upcoming",
              daysUntilStart: 6,
              totalWeeks: 7
            },
            sessionsDone: 0
          },
          workoutNames: []
        },
        {
          id: ppl.id,
          name: "PPL",
          startDate: null,
          endDate: null,
          isActive: true,
          progress: {
            planWeek: null,
            sessionsDone: 0
          },
          workoutNames: [ "Pull", "Legs" ]
        }
      ]);
    });

    it("shows a Plan Ended only once its To date has passed, keeping its place", () => {
      createPlan({
        name: "Old block",
        endDate: "2026-10-26"
      });
      createPlan({
        name: "Ends today",
        endDate: "2026-10-27"
      });
      createPlan({
        name: "Open-ended",
        startDate: "2026-01-01"
      });

      expect(listPlanCards("2026-10-27").map(({ name, progress }) => [ name, progress.planWeek?.status ])).toEqual([
        [ "Open-ended", "running" ],
        [ "Ends today", undefined ],
        [ "Old block", "ended" ]
      ]);
    });

    it("leaves deleted Plans out", () => {
      const gone = createPlan({ name: "Gone" });

      createPlan({ name: "Kept" });
      deletePlan(gone.id);

      expect(listPlanCards("2026-10-27").map(p => p.name)).toEqual([ "Kept" ]);
    });
  });
});
