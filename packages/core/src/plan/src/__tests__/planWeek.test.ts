import { getPlanWeek } from "../planWeek";

describe("getPlanWeek", () => {
  // From Mon 2 Nov 2026 to Sun 13 Dec 2026: 6 weeks.
  const sixWeeks = {
    startDate: "2026-11-02",
    endDate: "2026-12-13"
  };

  it("counts Plan Weeks in 7-day steps from From", () => {
    expect([
      "2026-11-02",
      "2026-11-08",
      "2026-11-09",
      "2026-11-18",
      "2026-12-13"
    ].map(today => getPlanWeek(sixWeeks, today))).toEqual([
      {
        status: "running",
        week: 1,
        totalWeeks: 6
      },
      {
        status: "running",
        week: 1,
        totalWeeks: 6
      },
      {
        status: "running",
        week: 2,
        totalWeeks: 6
      },
      {
        status: "running",
        week: 3,
        totalWeeks: 6
      },
      {
        status: "running",
        week: 6,
        totalWeeks: 6
      }
    ]);
  });

  it("rounds a To date that isn't a whole number of weeks up", () => {
    expect(getPlanWeek({
      startDate: "2026-11-02",
      endDate: "2026-11-16"
    }, "2026-11-02")).toEqual({
      status: "running",
      week: 1,
      totalWeeks: 3
    });
    expect(getPlanWeek({
      startDate: "2026-11-02",
      endDate: "2026-11-02"
    }, "2026-11-02")).toEqual({
      status: "running",
      week: 1,
      totalWeeks: 1
    });
  });

  it("counts days to go before From", () => {
    expect(getPlanWeek(sixWeeks, "2026-10-27")).toEqual({
      status: "upcoming",
      daysUntilStart: 6,
      totalWeeks: 6
    });
    expect(getPlanWeek(sixWeeks, "2026-11-01")).toEqual({
      status: "upcoming",
      daysUntilStart: 1,
      totalWeeks: 6
    });
  });

  it("ends the day after To", () => {
    expect(getPlanWeek(sixWeeks, "2026-12-14")).toEqual({
      status: "ended",
      totalWeeks: 6
    });
  });

  it("counts days across a daylight-saving change and a year end", () => {
    expect(getPlanWeek({
      startDate: "2026-12-28",
      endDate: "2027-04-04"
    }, "2027-03-29")).toEqual({
      status: "running",
      week: 14,
      totalWeeks: 14
    });
  });

  it("has no total without a To date", () => {
    expect(getPlanWeek({
      startDate: "2026-11-02",
      endDate: null
    }, "2026-11-18")).toEqual({
      status: "running",
      week: 3,
      totalWeeks: null
    });
  });

  it("only reads Ended without a From date", () => {
    const toOnly = {
      startDate: null,
      endDate: "2026-12-13"
    };

    expect(getPlanWeek(toOnly, "2026-12-13")).toBeNull();
    expect(getPlanWeek(toOnly, "2026-12-14")).toEqual({
      status: "ended",
      totalWeeks: null
    });
  });

  it("has nothing to show without dates", () => {
    expect(getPlanWeek({
      startDate: null,
      endDate: null
    }, "2026-11-18")).toBeNull();
  });
});
