import { describe, expect, it } from "@jest/globals";

import {
  formatCountdown, formatDate, formatDuration, formatEntrySummary, formatPlanDates, formatSessionWhen
} from "../format";

describe("formatCountdown", () => {
  it("shows minutes and seconds, rounding up to the next second", () => {
    expect(formatCountdown(90_000)).toBe("1:30");
    expect(formatCountdown(4_200)).toBe("0:05");
  });

  it("stops at zero", () => {
    expect(formatCountdown(-1_000)).toBe("0:00");
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
