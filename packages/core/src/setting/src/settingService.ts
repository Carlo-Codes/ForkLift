import { settingSchema } from "@forklift/db/client";
import type {
  SettingAttributes, TransactionType, Unit
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

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

  const setting = getSettingRow(tx);

  debug.info("setting unit to %s", parsed.data.unit);

  return setting ?
    updateSettingDb(setting.id, parsed.data, tx) :
    createSettingDb(parsed.data, tx);
}
