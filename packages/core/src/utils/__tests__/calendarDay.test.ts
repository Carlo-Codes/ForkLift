import { fromCalendarDay, toCalendarDay } from "../calendarDay";

describe("calendar days", () => {
  it("reads a Date as the day it falls on where the phone is", () => {
    expect(toCalendarDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("turns a day back into a Date on that day where the phone is", () => {
    const date = fromCalendarDay("2026-01-05");

    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ]).toEqual([
      2026,
      0,
      5
    ]);
    expect(toCalendarDay(date)).toBe("2026-01-05");
  });
});
