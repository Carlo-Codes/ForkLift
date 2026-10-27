// A Plan's length in weeks and its To date are two views of the same thing
// (ADR-0006): To is From + weeks × 7 − 1 days. Both dates are YYYY-MM-DD
// calendar days, counted in UTC so a daylight-saving change can't add or lose
// a day.

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

// Whole days from one YYYY-MM-DD calendar day to another, negative when to is
// earlier.
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

// The To date of a Plan from startDate lasting weeks, e.g. 1 week from a
// Tuesday ends on the Monday after.
export function planToDate(startDate: string, weeks: number): string {
  return new Date((dayNumber(startDate) + weeks * 7 - 1) * DAY_MS).toISOString()
    .slice(0, 10);
}

// The weeks a Plan from startDate to endDate covers, a part week rounded up;
// the inverse of planToDate.
export function planWeeks(startDate: string, endDate: string): number {
  return Math.ceil((daysBetween(startDate, endDate) + 1) / 7);
}
