import type { TransactionType } from "@forklift/db/client";

import { toCalendarDay } from "#utils/calendarDay";
import { addDays, daysBetween } from "#utils/planWeeks";

import { getPlan, listFinishedPlanSessions } from "./planService";
import { getPlanWeek } from "./planWeek";

// A finished Session as a Plan Calendar day shows it.
export interface PlanCalendarSession {
  id: string;
  workoutName: string;
  startedAt: Date;
}

export interface PlanCalendarDay {
  // A YYYY-MM-DD calendar day, local time.
  day: string;
  // False before the Plan's From date or after its To date.
  inPlan: boolean;
  // The day's finished Sessions, oldest first.
  sessions: PlanCalendarSession[];
}

export interface PlanCalendarWeek {
  // N for Week N of the Plan; null for a week before From, after To, or of a
  // Plan with no From date.
  planWeek: number | null;
  days: PlanCalendarDay[];
}

// A Plan's finished Sessions day by day, one row of 7 days per week (GLOSSARY:
// Plan Calendar). No weeks when there's nothing to show.
export interface PlanCalendar {
  weeks: PlanCalendarWeek[];
}

// 1970-01-05 was a Monday.
const MONDAY = "1970-01-05";

// The Monday on or before day; an undated Plan's weeks start on Mondays.
function mondayOf(day: string): string {
  const weekday = ((daysBetween(MONDAY, day) % 7) + 7) % 7;

  return addDays(day, -weekday);
}

const earliest = (...days: (string | undefined)[]) => days.filter(d => d !== undefined).sort()[ 0 ];

const latest = (...days: (string | undefined)[]) => days.filter(d => d !== undefined).sort()
  .at(-1);

// The Plan Calendar of a Plan, as at today (a YYYY-MM-DD calendar day). Weeks
// start on the weekday of the Plan's From date and run from From to To,
// stretched to take in any Session before or after them. With no To date the
// Active Plan runs to today's week, and any other Plan to its last finished
// Session's week (or From's week, with none), so a Plan last trained long ago
// doesn't run on to today. With no From date weeks start on the Monday of the
// first Session's week, and with no Sessions either there's nothing to show.
export function getPlanCalendar(
  planId: string,
  today = toCalendarDay(new Date()),
  tx?: TransactionType
): PlanCalendar {
  const {
    startDate, endDate, isActive
  } = getPlan(planId, tx);

  const sessions = listFinishedPlanSessions(planId, tx).reverse()
    .map(({ session, workout }) => ({
      day: toCalendarDay(session.startedAt),
      session: {
        id: session.id,
        workoutName: workout.name,
        startedAt: session.startedAt
      }
    }));

  const firstSession = sessions[ 0 ]?.day;
  const anchor = startDate ?? (firstSession && mondayOf(firstSession));

  if (!anchor) {
    return { weeks: [] };
  }

  // Sessions oldest first, so each day's list stays in order.
  const sessionsByDay = new Map<string, PlanCalendarSession[]>();

  for (const { day, session } of sessions) {
    const daySessions = sessionsByDay.get(day);

    if (daySessions) {
      daySessions.push(session);
    } else {
      sessionsByDay.set(day, [ session ]);
    }
  }

  const from = earliest(startDate ?? undefined, firstSession)!;
  // Never before From's week (the anchor), even if every Session is before From.
  const to = latest(endDate ?? (isActive ? today : undefined), sessions.at(-1)?.day, anchor)!;
  // Whole weeks back from the anchor, so a Session before From gets its row.
  const firstRow = addDays(anchor, -7 * Math.max(0, Math.ceil(daysBetween(from, anchor) / 7)));
  const rows = Math.floor(daysBetween(firstRow, to) / 7) + 1;
  const inPlan = (day: string) => (!startDate || day >= startDate) && (!endDate || day <= endDate);

  // Week N of a row in the Plan; To is left out, as inPlan already checks it.
  const planWeekOf = (rowStart: string) => {
    const week = inPlan(rowStart) ? getPlanWeek({ startDate }, rowStart) : null;

    return week?.status === "running" ? week.week : null;
  };

  return {
    weeks: Array.from({ length: rows }, (_, row) => {
      const rowStart = addDays(firstRow, row * 7);

      return {
        planWeek: planWeekOf(rowStart),
        days: Array.from({ length: 7 }, (__, i) => {
          const day = addDays(rowStart, i);

          return {
            day,
            inPlan: inPlan(day),
            sessions: sessionsByDay.get(day) ?? []
          };
        })
      };
    })
  };
}
