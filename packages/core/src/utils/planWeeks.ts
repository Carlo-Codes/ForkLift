// A Plan's length in weeks and its To date are two views of the same thing
// (ADR-0006): To is From + weeks × 7 − 1 days. Both dates are YYYY-MM-DD
// calendar days, counted in UTC so a daylight-saving change can't add or lose
// a day.

import { z } from "zod";

export const MAX_PLAN_WEEKS = 52;
// The length a Plan starts with: the New plan form's, and a Plan given a start
// date in the Plan editor without one.
export const DEFAULT_PLAN_WEEKS = 8;

// A Plan's length as the lifter picks it, at most maxWeeks: MAX_PLAN_WEEKS, or
// the longer length the AI gave a Plan, so the lifter can shorten it a week at
// a time.
export function planWeeksSchema(maxWeeks = MAX_PLAN_WEEKS) {
  return z.number().int("Weeks must be a whole number")
    .min(1, "A plan lasts at least 1 week")
    .max(maxWeeks, `A plan lasts at most ${maxWeeks} weeks`);
}

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
