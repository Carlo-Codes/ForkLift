import type { ExerciseEntryAttributes, Unit } from "@forklift/db/client";

// e.g. "3 × 10 @ 60kg · rest 90s"; weight is left out for 0 (bodyweight).
export function formatTargets(
  entry: Pick<ExerciseEntryAttributes, "targetSets" | "targetReps" | "targetWeight" | "restSeconds">,
  unit: Unit
): string {
  const weight = entry.targetWeight > 0 ? ` @ ${entry.targetWeight}${unit}` : "";

  return `${entry.targetSets} × ${entry.targetReps}${weight} · rest ${entry.restSeconds}s`;
}
