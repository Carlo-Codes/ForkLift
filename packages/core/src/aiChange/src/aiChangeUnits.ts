import type {
  AiChangeRow, TransactionType, Unit
} from "@forklift/db/client";

import { convertTargetWeight, convertWeightStep } from "#exerciseEntry/exerciseEntryUnits";

import { getAllAiChangeByQuery, updateAiChangeDb } from "./aiChangeDb";

// The Exercise Entry columns held in the lifter's unit, and how each converts.
const CONVERTERS: Record<string, ((value: number, from: Unit, to: Unit) => number) | undefined> = {
  targetWeight: convertTargetWeight,
  weightStep: convertWeightStep
};

function convertValues(values: Record<string, unknown>, from: Unit, to: Unit): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).map(([ column, value ]) => {
    const convert = CONVERTERS[ column ];

    return [ column, convert && typeof value === "number" ? convert(value, from, to) : value ];
  }));
}

function convertRow(row: AiChangeRow, from: Unit, to: Unit): AiChangeRow {
  if (row.table !== "exerciseEntry") {
    return row;
  }

  return {
    ...row,
    before: row.before && convertValues(row.before, from, to),
    after: convertValues(row.after, from, to)
  };
}

// Rewrites the Exercise Entry weights each Change by AI recorded, as setUnit
// does the entries themselves, so Undo still finds the values the AI left and
// puts back the ones before it, in the lifter's unit. Called by setUnit.
export function convertAiChangeWeights(from: Unit, to: Unit, tx?: TransactionType): void {
  if (from === to) {
    return;
  }

  // drizzle rejects an undefined filter, so match every row explicitly.
  for (const change of getAllAiChangeByQuery({ where: { id: { isNotNull: true } } }, tx)) {
    updateAiChangeDb(change.id, { rows: change.rows.map(row => convertRow(row, from, to)) }, tx);
  }
}
