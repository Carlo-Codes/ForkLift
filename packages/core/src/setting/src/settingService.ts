import { settingSchema } from "@forklift/db/client";
import type {
  SettingAttributes, TransactionType, Unit
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { convertExerciseEntryWeights } from "../../plan/workout/block/exerciseEntry/src/exerciseEntryUnits";
import { inTransaction } from "../../utils/transaction";
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
  const parsed = settingSchema.pick({ unit: true }).safeParse({ unit });

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map(i => i.message).join("; "), "ValidationError");
  }

  // Stored weights are in the current unit, so they convert in the same
  // transaction as the switch.
  return inTransaction(tx, t => {
    const setting = getSettingRow(t);

    debug.info("setting unit to %s", parsed.data.unit);
    convertExerciseEntryWeights(getSettings(t).unit, parsed.data.unit, t);

    return setting ?
      updateSettingDb(setting.id, parsed.data, t) :
      createSettingDb(parsed.data, t);
  });
}
