import type {
  HistorySet, HomeEntry, PlanListItem, SupersetPosition
} from "@forklift/core";
import type { ExerciseEntryAttributes, Unit } from "@forklift/db/client";

// e.g. "3 × 10 @ 60kg · rest 90s"; weight is left out for 0 (bodyweight).
export function formatTargets(
  entry: Pick<ExerciseEntryAttributes, "targetSets" | "targetReps" | "targetWeight" | "restSeconds">,
  unit: Unit
): string {
  const weight = entry.targetWeight > 0 ? ` @ ${entry.targetWeight}${unit}` : "";

  return `${entry.targetSets} × ${entry.targetReps}${weight} · rest ${entry.restSeconds}s`;
}

// e.g. "50kg × 10"; just "10 reps" for 0 (bodyweight).
export function formatSet(reps: number, weight: number, unit: Unit): string {
  return weight > 0 ? `${weight}${unit} × ${reps}` : `${reps} reps`;
}

// A run of sets as "57.5kg × 8, 8, 7", naming the weight again only where it
// changes: "60kg × 8, 57.5kg × 7"; bodyweight sets read "8, 8, 7 reps".
export function formatSets(sets: Pick<HistorySet, "reps" | "weight">[], unit: Unit): string {
  return sets.map((set, i) => {
    if (i > 0 && set.weight === sets[ i - 1 ]!.weight) {
      return String(set.reps);
    }

    return set.weight > 0 ? `${set.weight}${unit} × ${set.reps}` : String(set.reps);
  }).join(", ") + (sets.at(-1)?.weight === 0 ? " reps" : "");
}

// e.g. "Sun 25 Oct 2026".
export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Text fields hold what the lifter types; an empty or non-numeric field becomes
// NaN, which @forklift/core rejects with a ValidationError.
export function toNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text.replace(",", "."));
}

// e.g. "A2 · Superset 1/2": the Exercise Entry and round, then its place in the
// round.
export function formatSupersetPosition(setNumber: number, {
  letter, position, roundSize
}: SupersetPosition): string {
  return `${letter}${setNumber} · Superset ${position}/${roundSize}`;
}

// A Workout's Exercise Entries at a glance, e.g. "Bench Press 3×8 · Row 3×10 · …",
// naming at most limit of them.
export function formatEntrySummary(entries: HomeEntry[], limit = 4): string {
  const named = entries.slice(0, limit).map(e => `${e.exerciseName} ${e.targetSets}×${e.targetReps}`);

  return [ ...named, ...(entries.length > limit ? [ "…" ] : []) ].join(" · ");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

// A YYYY-MM-DD calendar day as "5 Jan 2026", or "5 Jan" without its year. Read
// from the text, not a Date, so no time zone can shift it (ADR-0006).
function formatCalendarDay(day: string, withYear = true): string {
  const [
    year,
    month,
    date
  ] = day.split("-").map(Number);

  return `${date} ${MONTHS[ month! - 1 ]}${withYear ? ` ${year}` : ""}`;
}

// A Plan's From and To dates, e.g. "5 Jan – 1 Mar 2026", "From 2 Nov 2026",
// "Until 20 Dec 2026" or "No dates".
export function formatPlanDates({ startDate, endDate }: Pick<PlanListItem, "startDate" | "endDate">): string {
  if (startDate && endDate) {
    const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);

    return `${formatCalendarDay(startDate, !sameYear)} – ${formatCalendarDay(endDate)}`;
  }

  if (startDate) {
    return `From ${formatCalendarDay(startDate)}`;
  }

  return endDate ? `Until ${formatCalendarDay(endDate)}` : "No dates";
}

// e.g. "Sun 25 Oct 2026, 14:05".
export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}
