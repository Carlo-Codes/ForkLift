import type { PlanAttributes } from "@forklift/db/client";

const DAY_MS = 86_400_000;

// Whole days from one YYYY-MM-DD calendar day to another, negative when to is
// earlier. Counted at UTC midnight, so no daylight-saving change can skew it.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

// Where a Plan stands on a given day, by its Plan Weeks (GLOSSARY): Week N
// counts in 7-day steps from From, and To gives the total weeks, rounded up.
// totalWeeks is null without both dates. It is shown only: it never chooses or
// ends the Active Plan (ADR-0006).
export type PlanWeek =
  | { status: "upcoming"; daysUntilStart: number; totalWeeks: number | null }
  | { status: "running"; week: number; totalWeeks: number | null }
  | { status: "ended"; totalWeeks: number | null };

type PlanDates = { [K in "startDate" | "endDate"]?: PlanAttributes[K] };

// The Plan's week on today, a YYYY-MM-DD calendar day. Null when there's
// nothing to show: no dates, or only a To date that hasn't passed yet.
export function getPlanWeek({ startDate, endDate }: PlanDates, today: string): PlanWeek | null {
  const totalWeeks = startDate && endDate ? Math.ceil((daysBetween(startDate, endDate) + 1) / 7) : null;

  // YYYY-MM-DD strings compare in calendar order.
  if (endDate && endDate < today) {
    return {
      status: "ended",
      totalWeeks
    };
  }

  if (!startDate) {
    return null;
  }

  const daysIn = daysBetween(startDate, today);

  if (daysIn < 0) {
    return {
      status: "upcoming",
      daysUntilStart: -daysIn,
      totalWeeks
    };
  }

  return {
    status: "running",
    week: Math.floor(daysIn / 7) + 1,
    totalWeeks
  };
}
