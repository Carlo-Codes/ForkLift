import { describe, expect, it } from "@jest/globals";

import {
  formatCountdown,
  formatDate,
  formatDuration,
  formatEntrySummary,
  formatList,
  formatPlanDates,
  formatPlanProgress,
  formatPlanWeek,
  formatSessionWhen,
  formatSetTargets,
  formatWeekdayLetter,
  formatWorkoutLetters,
  planWeekFraction,
  stepValue
} from "../format";

describe("formatList", () => {
  it("joins names with commas and a final \"and\"", () => {
    expect(formatList([
      "Push",
      "Pull",
      "Legs"
    ])).toBe("Push, Pull and Legs");
    expect(formatList([ "Upper", "Lower" ])).toBe("Upper and Lower");
    expect(formatList([ "Full Body" ])).toBe("Full Body");
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds, rounding up to the next second", () => {
    expect(formatCountdown(90_000)).toBe("1:30");
    expect(formatCountdown(4_200)).toBe("0:05");
  });

  it("stops at zero", () => {
    expect(formatCountdown(-1_000)).toBe("0:00");
  });
});

describe("formatSetTargets", () => {
  it("shows sets × reps × weight", () => {
    expect(formatSetTargets({
      totalSets: 3,
      targetReps: 8,
      targetWeight: 57.5
    }, "kg")).toBe("3 × 8 × 57.5kg");
  });

  it("leaves the weight out for bodyweight", () => {
    expect(formatSetTargets({
      totalSets: 4,
      targetReps: 12,
      targetWeight: 0
    }, "lb")).toBe("4 × 12 reps");
  });
});

describe("formatDuration", () => {
  const start = new Date("2026-10-25T14:00:00Z");
  const after = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

  it("shows minutes under an hour", () => {
    expect(formatDuration(start, after(52))).toBe("52 min");
  });

  it("shows hours and minutes from an hour", () => {
    expect(formatDuration(start, after(75))).toBe("1 h 15 min");
    expect(formatDuration(start, after(120))).toBe("2 h");
  });

  it("rounds to the nearest minute, never below one", () => {
    expect(formatDuration(start, new Date(start.getTime() + 20_000))).toBe("1 min");
  });
});

describe("formatSessionWhen", () => {
  it("shows the date a Session started and how long it took", () => {
    const startedAt = new Date(2026, 9, 25, 14, 0);
    const finishedAt = new Date(2026, 9, 25, 15, 15);

    expect(formatSessionWhen({
      startedAt,
      finishedAt
    })).toBe(`${formatDate(startedAt)} · 1 h 15 min`);
  });
});

describe("formatEntrySummary", () => {
  const entry = (exerciseName: string, targetSets: number, targetReps: number) => ({
    exerciseName,
    targetSets,
    targetReps
  });

  it("lists each Exercise Entry with its sets and reps", () => {
    expect(formatEntrySummary([ entry("Bench Press", 3, 8), entry("Row", 3, 10) ]))
      .toBe("Bench Press 3×8 · Row 3×10");
  });

  it("cuts a long list short with an ellipsis", () => {
    expect(formatEntrySummary([
      entry("A", 1, 1),
      entry("B", 2, 2),
      entry("C", 3, 3),
      entry("D", 4, 4),
      entry("E", 5, 5)
    ], 3)).toBe("A 1×1 · B 2×2 · C 3×3 · …");
  });

  it("is empty with no Exercise Entries", () => {
    expect(formatEntrySummary([])).toBe("");
  });
});

describe("formatPlanDates", () => {
  it("says so when a Plan has no dates", () => {
    expect(formatPlanDates({
      startDate: null,
      endDate: null
    })).toBe("No dates");
  });

  it("shows From and To as calendar days, naming a shared year once", () => {
    expect(formatPlanDates({
      startDate: "2026-01-05",
      endDate: "2026-03-01"
    })).toBe("5 Jan – 1 Mar 2026");
    expect(formatPlanDates({
      startDate: "2026-12-01",
      endDate: "2027-01-31"
    })).toBe("1 Dec 2026 – 31 Jan 2027");
  });

  it("shows a date set on its own", () => {
    expect(formatPlanDates({
      startDate: "2026-11-02",
      endDate: null
    })).toBe("From 2 Nov 2026");
    expect(formatPlanDates({
      startDate: null,
      endDate: "2026-12-20"
    })).toBe("Until 20 Dec 2026");
  });
});

describe("formatPlanWeek", () => {
  it("reads the Plan Week out of the total, or alone without a To date", () => {
    expect(formatPlanWeek({
      status: "running",
      week: 3,
      totalWeeks: 6
    })).toBe("Week 3 of 6");
    expect(formatPlanWeek({
      status: "running",
      week: 3,
      totalWeeks: null
    })).toBe("Week 3");
  });

  it("counts the days to the start", () => {
    expect(formatPlanWeek({
      status: "upcoming",
      daysUntilStart: 5,
      totalWeeks: 6
    })).toBe("Starts in 5 days");
    expect(formatPlanWeek({
      status: "upcoming",
      daysUntilStart: 1,
      totalWeeks: 6
    })).toBe("Starts tomorrow");
  });

  it("reads Ended after the end", () => {
    expect(formatPlanWeek({
      status: "ended",
      totalWeeks: 6
    })).toBe("Ended");
  });
});

describe("planWeekFraction", () => {
  it("fills the bar by Plan Week, empty before the start and full after the end", () => {
    expect(([
      {
        status: "upcoming",
        daysUntilStart: 5,
        totalWeeks: 6
      },
      {
        status: "running",
        week: 3,
        totalWeeks: 6
      },
      {
        status: "ended",
        totalWeeks: null
      }
    ] as const).map(planWeekFraction)).toEqual([
      0,
      0.5,
      1
    ]);
  });

  it("has no bar while a Plan with no To date runs", () => {
    expect(planWeekFraction({
      status: "running",
      week: 3,
      totalWeeks: null
    })).toBeNull();
  });
});

describe("formatPlanProgress", () => {
  it("reads the Plan Week and the Sessions done", () => {
    expect(formatPlanProgress({
      planWeek: {
        status: "running",
        week: 3,
        totalWeeks: 6
      },
      sessionsDone: 7
    })).toBe("Week 3 of 6 · 7 sessions done");
    expect(formatPlanProgress({
      planWeek: {
        status: "ended",
        totalWeeks: 6
      },
      sessionsDone: 1
    })).toBe("Ended · 1 session done");
  });

  it("leaves out no Sessions done before the start, and the week without dates", () => {
    expect(formatPlanProgress({
      planWeek: {
        status: "upcoming",
        daysUntilStart: 5,
        totalWeeks: 6
      },
      sessionsDone: 0
    })).toBe("Starts in 5 days");
    expect(formatPlanProgress({
      planWeek: null,
      sessionsDone: 2
    })).toBe("2 sessions done");
    expect(formatPlanProgress({
      planWeek: null,
      sessionsDone: 0
    })).toBeUndefined();
  });
});

describe("formatWeekdayLetter", () => {
  it("reads the weekday from the calendar day itself", () => {
    expect([
      "2026-11-02",
      "2026-11-04",
      "2026-11-08"
    ].map(formatWeekdayLetter)).toEqual([
      "M",
      "W",
      "S"
    ]);
  });
});

describe("formatWorkoutLetters", () => {
  it("shows each Session's Workout by its first letter, at most two", () => {
    expect(formatWorkoutLetters([ { workoutName: "push" } ])).toBe("P");
    expect(formatWorkoutLetters([
      { workoutName: "Push" },
      { workoutName: "Legs" },
      { workoutName: "Pull" }
    ])).toBe("PL");
  });

  it("shows a dot alone for a Workout with no name", () => {
    expect(formatWorkoutLetters([ { workoutName: "" } ])).toBe("");
  });
});

describe("stepValue", () => {
  it("steps up or down, without the float drift of adding decimals", () => {
    expect(stepValue(60, 2.5, 0, 10000)).toBe(62.5);
    expect(stepValue(0.2, 0.1, 0, 10)).toBe(0.3);
    expect(stepValue(90, -15, 0, 3600)).toBe(75);
  });

  it("stops at the bounds", () => {
    expect(stepValue(1, -1, 1, 50)).toBe(1);
    expect(stepValue(10, -15, 0, 3600)).toBe(0);
    expect(stepValue(3590, 15, 0, 3600)).toBe(3600);
  });
});
