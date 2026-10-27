import { describe, expect, it } from "@jest/globals";

import { formatEntrySummary } from "../format";

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
