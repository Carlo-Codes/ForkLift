import { DEFAULT_WEIGHT_STEP } from "@forklift/db/client";
import type { TransactionType, Unit } from "@forklift/db/client";

import { getAllExerciseEntryByQuery, updateExerciseEntryDb } from "./exerciseEntryDb";

const KG_PER_LB = 0.45359237;

function convert(weight: number, from: Unit, to: Unit): number {
  const converted = from === to ? weight : from === "kg" ? weight / KG_PER_LB : weight * KG_PER_LB;

  return Math.round(converted * 10) / 10;
}

// Rewrites every stored target weight and Weight Step from one unit to the other,
// to the nearest 0.1. A Weight Step left at the default becomes the other unit's
// default (2.5kg <-> 5lb) rather than an odd 5.5lb, and no step rounds down to
// 0. Soft-deleted entries convert too, so one restored later is still in the
// lifter's unit. Called by setUnit.
export function convertExerciseEntryWeights(from: Unit, to: Unit, tx?: TransactionType): void {
  if (from === to) {
    return;
  }

  for (const entry of getAllExerciseEntryByQuery({
    // drizzle rejects an undefined filter, so match every row explicitly.
    where: { id: { isNotNull: true } }
  }, tx)) {
    updateExerciseEntryDb(entry.id, {
      targetWeight: convert(entry.targetWeight, from, to),
      weightStep: entry.weightStep === DEFAULT_WEIGHT_STEP[ from ] ?
        DEFAULT_WEIGHT_STEP[ to ] :
        Math.max(0.1, convert(entry.weightStep, from, to))
    }, tx);
  }
}
