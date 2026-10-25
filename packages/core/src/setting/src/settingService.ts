import { settingSchema } from "@forklift/db/client";
import type {
  SettingAttributes, TransactionType, Unit
} from "@forklift/db/client";
import { createDebugger } from "@forklift/debug";

import { convertExerciseEntryWeights } from "../../plan/workout/block/exerciseEntry/src/exerciseEntryUnits";
import { convertSessionWeights } from "../../session/src/sessionUnits";
import { inTransaction } from "../../utils/transaction";
import { parseOrThrow } from "../../utils/validation";
import {
  createSettingDb, getSettingByQuery, updateSettingDb
} from "./settingDb";

const debug = createDebugger("settingService");
const DEFAULT_SETTINGS = { unit: "kg" } as const;

function getSettingRow(tx?: TransactionType) {
  return getSettingByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

// Settings are a single row; until the lifter changes something there is no
// row and the defaults apply.
export function getSettings(tx?: TransactionType): Pick<SettingAttributes, "unit"> {
  return getSettingRow(tx) ?? DEFAULT_SETTINGS;
}

export function setUnit(unit: Unit, tx?: TransactionType): Pick<SettingAttributes, "unit"> {
  const data = parseOrThrow(settingSchema.pick({ unit: true }), { unit });

  // Stored weights are in the current unit, so they convert in the same
  // transaction as the switch.
  return inTransaction(tx, t => {
    const setting = getSettingRow(t);
    const from = getSettings(t).unit;

    debug.info("setting unit to %s", data.unit);
    convertExerciseEntryWeights(from, data.unit, t);
    convertSessionWeights(from, data.unit, t);

    return setting ?
      updateSettingDb(setting.id, data, t) :
      createSettingDb(data, t);
  });
}
