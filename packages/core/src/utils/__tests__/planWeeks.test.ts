import { planToDate, planWeeks } from "../planWeeks";

describe("Plan weeks", () => {
  describe("the To date for a start date and a number of weeks", () => {
    it("is the last day of the last week", () => {
      expect(planToDate("2026-10-27", 1)).toBe("2026-11-02");
      expect(planToDate("2026-10-27", 8)).toBe("2026-12-21");
    });

    it("counts calendar days across months, years and leap days", () => {
      expect(planToDate("2026-12-28", 1)).toBe("2027-01-03");
      expect(planToDate("2028-02-25", 1)).toBe("2028-03-02");
    });

    it("isn't shifted by a daylight-saving change", () => {
      // Clocks change in late March and late October in Europe, mid March and
      // early November in the US.
      expect(planToDate("2026-03-01", 6)).toBe("2026-04-11");
      expect(planToDate("2026-10-19", 4)).toBe("2026-11-15");
    });
  });

  describe("the weeks a From and To date cover", () => {
    it("reads back the weeks a To date was made from", () => {
      for (const weeks of [
        1,
        8,
        52
      ]) {
        expect(planWeeks("2026-10-27", planToDate("2026-10-27", weeks))).toBe(weeks);
      }
    });

    it("rounds a part week up", () => {
      expect(planWeeks("2026-10-27", "2026-10-27")).toBe(1);
      expect(planWeeks("2026-10-27", "2026-11-03")).toBe(2);
    });
  });
});
