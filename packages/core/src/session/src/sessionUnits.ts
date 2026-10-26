import { MAX_TARGET_WEIGHT } from "@forklift/db/client";
import type { TransactionType, Unit } from "@forklift/db/client";

import { convertWeight } from "#utils/units";
import { getAllLoggedSetByQuery, updateLoggedSetDb } from "#loggedSet/loggedSetDb";

import { getAllSessionByQuery, updateSessionDb } from "./sessionDb";

function convert(weight: number, from: Unit, to: Unit): number {
  return Math.min(MAX_TARGET_WEIGHT, convertWeight(weight, from, to));
}

// Rewrites every Logged Set's weight and every Session's snapshotted target
// weights from one unit to the other, so history and a running Session stay in
// the lifter's unit. Soft-deleted rows convert too. Called by setUnit.
export function convertSessionWeights(from: Unit, to: Unit, tx?: TransactionType): void {
  if (from === to) {
    return;
  }

  // drizzle rejects an undefined filter, so match every row explicitly.
  for (const session of getAllSessionByQuery({ where: { id: { isNotNull: true } } }, tx)) {
    updateSessionDb(session.id, {
      blocks: session.blocks.map(entries => entries.map(entry => ({
        ...entry,
        targetWeight: convert(entry.targetWeight, from, to)
      })))
    }, tx);
  }

  for (const loggedSet of getAllLoggedSetByQuery({ where: { id: { isNotNull: true } } }, tx)) {
    updateLoggedSetDb(loggedSet.id, { weight: convert(loggedSet.weight, from, to) }, tx);
  }
}
