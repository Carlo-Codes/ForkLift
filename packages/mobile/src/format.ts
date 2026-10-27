import type {
  HistorySet, HomeEntry, SessionSummary, SupersetPosition
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

// A rest countdown as "1:30", rounding up so it reads "0:00" only once the
// rest is over.
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// How long a Session took, e.g. "52 min" or "1 h 15 min".
export function formatDuration(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} min`;
  }

  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

// When a past Session happened, e.g. "Sun 25 Oct 2026 · 1 h 15 min".
export function formatSessionWhen({ startedAt, finishedAt }: Pick<SessionSummary, "startedAt" | "finishedAt">): string {
  return `${formatDate(startedAt)} · ${formatDuration(startedAt, finishedAt)}`;
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

// e.g. "Sun 25 Oct 2026, 14:05".
export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}
