import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createPlan, deletePlan, getPlanCalendar, setActivePlan
} from "..";
import type { PlanCalendar } from "..";
import { createExercise } from "#exercise";
import { createBlock } from "#block";
import { createWorkout } from "#workout";
import { finishSession, startSession } from "#session";
import { updateSessionDb } from "#session/sessionDb";

describe("getPlanCalendar", () => {
  let teardown: () => void;
  let benchId: string;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
    ({ id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ]
    }));
  });

  afterEach(() => teardown());

  // A Workout of the Plan with one Exercise Entry, ready to Start.
  const addWorkout = (planId: string, name: string) => {
    const workout = createWorkout(planId, { name });

    createBlock(workout.id, {
      exerciseId: benchId,
      targetSets: 3,
      targetReps: 8
    });

    return workout;
  };

  // A finished Session of the Workout, started at startedAt.
  const finishAt = (workoutId: string, startedAt: Date) => {
    const session = finishSession(startSession(workoutId).id);

    return updateSessionDb(session.id, { startedAt });
  };

  // Local time, so the calendar day doesn't depend on the test's time zone.
  const at = (day: string, hour = 18) => {
    const [
      year,
      month,
      date
    ] = day.split("-").map(Number);

    return new Date(year!, month! - 1, date, hour);
  };

  // The calendar as rows of "label: day day …", a day marked * when out of
  // the Plan and followed by its Sessions' Workout names.
  const sketch = ({ weeks }: PlanCalendar) => weeks.map(({ planWeek, days }) => `${planWeek ?? "-"}: ${days.map(d => `${d.day}${d.inPlan ? "" : "*"}${d.sessions.map(s => ` ${s.workoutName}`).join("")}`).join(", ")}`);

  it("groups finished Sessions by local calendar day, oldest first, with their Workout names", () => {
    const plan = createPlan({
      name: "PPL",
      startDate: "2026-11-02",
      endDate: "2026-11-15"
    });
    const push = addWorkout(plan.id, "Push");
    const pull = addWorkout(plan.id, "Pull");

    const late = finishAt(pull.id, at("2026-11-04", 19));
    const early = finishAt(push.id, at("2026-11-04", 7));

    finishAt(push.id, at("2026-11-10", 23));

    const calendar = getPlanCalendar(plan.id, "2026-11-05");

    expect(sketch(calendar)).toEqual([
      "1: 2026-11-02, 2026-11-03, 2026-11-04 Push Pull, 2026-11-05, 2026-11-06, 2026-11-07, 2026-11-08",
      "2: 2026-11-09, 2026-11-10 Push, 2026-11-11, 2026-11-12, 2026-11-13, 2026-11-14, 2026-11-15"
    ]);
    expect(calendar.weeks[ 0 ]!.days[ 2 ]!.sessions).toEqual([
      {
        id: early.id,
        workoutName: "Push",
        startedAt: at("2026-11-04", 7)
      },
      {
        id: late.id,
        workoutName: "Pull",
        startedAt: at("2026-11-04", 19)
      }
    ]);
  });

  it("stretches to Sessions before From and after To, out of the Plan and with no Plan Week", () => {
    // Wednesday 4 to Tuesday 10 November: one Plan Week.
    const plan = createPlan({
      name: "Block",
      startDate: "2026-11-04",
      endDate: "2026-11-10"
    });
    const push = addWorkout(plan.id, "Push");

    finishAt(push.id, at("2026-10-26"));
    finishAt(push.id, at("2026-11-11"));

    expect(sketch(getPlanCalendar(plan.id, "2026-12-01"))).toEqual([
      "-: 2026-10-21*, 2026-10-22*, 2026-10-23*, 2026-10-24*, 2026-10-25*, 2026-10-26* Push, 2026-10-27*",
      "-: 2026-10-28*, 2026-10-29*, 2026-10-30*, 2026-10-31*, 2026-11-01*, 2026-11-02*, 2026-11-03*",
      "1: 2026-11-04, 2026-11-05, 2026-11-06, 2026-11-07, 2026-11-08, 2026-11-09, 2026-11-10",
      "-: 2026-11-11* Push, 2026-11-12*, 2026-11-13*, 2026-11-14*, 2026-11-15*, 2026-11-16*, 2026-11-17*"
    ]);
  });

  it("labels a last week that To ends part way through, dimming the days after To", () => {
    const plan = createPlan({
      name: "Block",
      startDate: "2026-11-02",
      endDate: "2026-11-10"
    });

    expect(sketch(getPlanCalendar(plan.id, "2026-11-05"))).toEqual([
      "1: 2026-11-02, 2026-11-03, 2026-11-04, 2026-11-05, 2026-11-06, 2026-11-07, 2026-11-08",
      "2: 2026-11-09, 2026-11-10, 2026-11-11*, 2026-11-12*, 2026-11-13*, 2026-11-14*, 2026-11-15*"
    ]);
  });

  it("runs the Active Plan with no To date to today's week, or its first week before it starts", () => {
    const plan = createPlan({
      name: "Open",
      startDate: "2026-11-02"
    });

    setActivePlan(plan.id);

    expect(getPlanCalendar(plan.id, "2026-11-17").weeks.map(w => w.planWeek)).toEqual([
      1,
      2,
      3
    ]);
    expect(getPlanCalendar(plan.id, "2026-10-20").weeks.map(w => w.planWeek)).toEqual([ 1 ]);
  });

  it("ends any other Plan with no To date at its last finished Session's week, not today", () => {
    const plan = createPlan({
      name: "Old",
      startDate: "2024-01-01"
    });
    const push = addWorkout(plan.id, "Push");

    finishAt(push.id, at("2024-01-02"));
    finishAt(push.id, at("2024-01-10"));

    expect(sketch(getPlanCalendar(plan.id, "2026-11-17"))).toEqual([
      "1: 2024-01-01, 2024-01-02 Push, 2024-01-03, 2024-01-04, 2024-01-05, 2024-01-06, 2024-01-07",
      "2: 2024-01-08, 2024-01-09, 2024-01-10 Push, 2024-01-11, 2024-01-12, 2024-01-13, 2024-01-14"
    ]);
  });

  it("ends any other Plan with no To date and no Sessions at its From date's week", () => {
    const plan = createPlan({
      name: "Old",
      startDate: "2024-01-03"
    });

    expect(sketch(getPlanCalendar(plan.id, "2026-11-17"))).toEqual([ "1: 2024-01-03, 2024-01-04, 2024-01-05, 2024-01-06, 2024-01-07, 2024-01-08, 2024-01-09" ]);
  });

  it("keeps a Plan with a To date running to To, whether it's Active or not", () => {
    const plan = createPlan({
      name: "Block",
      startDate: "2026-11-02",
      endDate: "2026-11-22"
    });
    const weeks = () => getPlanCalendar(plan.id, "2026-11-05").weeks.map(w => w.planWeek);

    expect(weeks()).toEqual([
      1,
      2,
      3
    ]);
    setActivePlan(plan.id);
    expect(weeks()).toEqual([
      1,
      2,
      3
    ]);
  });

  it("starts an undated Plan on the Monday of its first Session's week, running to today when Active", () => {
    const plan = createPlan({ name: "Undated" });
    const legs = addWorkout(plan.id, "Legs");

    finishAt(legs.id, at("2026-11-05"));
    setActivePlan(plan.id);

    expect(sketch(getPlanCalendar(plan.id, "2026-11-10"))).toEqual([
      "-: 2026-11-02, 2026-11-03, 2026-11-04, 2026-11-05 Legs, 2026-11-06, 2026-11-07, 2026-11-08",
      "-: 2026-11-09, 2026-11-10, 2026-11-11, 2026-11-12, 2026-11-13, 2026-11-14, 2026-11-15"
    ]);
  });

  it("ends an undated Plan that isn't Active at its last finished Session's week", () => {
    const plan = createPlan({ name: "Undated" });
    const legs = addWorkout(plan.id, "Legs");

    finishAt(legs.id, at("2024-03-06"));
    finishAt(legs.id, at("2024-03-12"));

    expect(sketch(getPlanCalendar(plan.id, "2026-11-10"))).toEqual([
      "-: 2024-03-04, 2024-03-05, 2024-03-06 Legs, 2024-03-07, 2024-03-08, 2024-03-09, 2024-03-10",
      "-: 2024-03-11, 2024-03-12 Legs, 2024-03-13, 2024-03-14, 2024-03-15, 2024-03-16, 2024-03-17"
    ]);
  });

  it("has no weeks for a Plan with no From date and no Sessions", () => {
    expect(getPlanCalendar(createPlan({ name: "Undated" }).id, "2026-11-10")).toEqual({ weeks: [] });
    expect(getPlanCalendar(createPlan({
      name: "Until",
      endDate: "2026-12-01"
    }).id, "2026-11-10")).toEqual({ weeks: [] });
  });

  it("shows only finished, live Sessions of this Plan", () => {
    const plan = createPlan({
      name: "PPL",
      startDate: "2026-11-02",
      endDate: "2026-11-08"
    });
    const other = createPlan({ name: "Other" });
    const push = addWorkout(plan.id, "Push");

    finishAt(addWorkout(other.id, "Elsewhere").id, at("2026-11-03"));
    updateSessionDb(finishAt(push.id, at("2026-11-04")).id, { deletedAt: new Date() });
    updateSessionDb(startSession(push.id).id, { startedAt: at("2026-11-05") });

    expect(getPlanCalendar(plan.id, "2026-11-05").weeks.flatMap(w => w.days.flatMap(d => d.sessions))).toEqual([]);
  });

  it("refuses a deleted Plan", () => {
    const plan = createPlan({ name: "Gone" });

    deletePlan(plan.id);

    expect(() => getPlanCalendar(plan.id, "2026-11-18")).toThrow(expect.objectContaining({ statusCode: 404 }) as ApiError);
  });
});
