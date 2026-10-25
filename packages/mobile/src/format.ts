import type { SessionSet } from "@forklift/core";
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

// Text fields hold what the lifter types; an empty or non-numeric field becomes
// NaN, which @forklift/core rejects with a ValidationError.
export function toNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text.replace(",", "."));
}

// e.g. "A2 · Superset 1/2": the entry and round, then its place in the round.
export function formatSupersetPosition({
  letter, round, position, roundSize
}: NonNullable<SessionSet["superset"]>): string {
  return `${letter}${round} · Superset ${position}/${roundSize}`;
}
