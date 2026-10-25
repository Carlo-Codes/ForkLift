import {
  DEFAULT_REST_SECONDS,
  DEFAULT_TARGET_REPS,
  DEFAULT_TARGET_SETS,
  DEFAULT_TARGET_WEIGHT,
  DEFAULT_WEIGHT_STEP,
  exerciseEntryCreatePayloadSchema,
  exerciseEntryUpdatePayloadSchema,
  MAX_TARGET_WEIGHT
} from "@forklift/db/client";
import type {
  ExerciseEntryAttributes,
  ExerciseEntryCreatePayload,
  ExerciseEntryUpdatePayload,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";

import { getSettings } from "../../../../../setting/src/settingService";
import { getExercise } from "../../../../../exercise/src/exerciseService";
import { deleteBlockDb, getBlockByQuery } from "../../src/blockDb";
import {
  createExerciseEntryDb,
  deleteExerciseEntryDb,
  getAllExerciseEntryByQuery,
  getExerciseEntryByQuery,
  updateExerciseEntryDb
} from "./exerciseEntryDb";

const debug = createDebugger("exerciseEntryService");

// Checked here rather than through getBlock so blockService can build on this
// module without an import cycle.
function getLiveBlockOrThrow(blockId: string, tx?: TransactionType) {
  const block = getBlockByQuery({
    where: {
      id: blockId,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!block) {
    throw new ApiError(404, `Block ${blockId} not found`, "NotFoundError");
  }

  return block;
}

export function getExerciseEntry(id: string, tx?: TransactionType): ExerciseEntryAttributes {
  const entry = getExerciseEntryByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!entry) {
    throw new ApiError(404, `Exercise entry ${id} not found`, "NotFoundError");
  }

  return entry;
}

// Adds an entry at the end of the Block. Targets the lifter leaves out take the
// defaults, the Weight Step the one for the current unit.
export function createExerciseEntry(
  blockId: string,
  payload: ExerciseEntryCreatePayload,
  tx?: TransactionType
): ExerciseEntryAttributes {
  const data = parseOrThrow(exerciseEntryCreatePayloadSchema, payload);
  const block = getLiveBlockOrThrow(blockId, tx);

  getExercise(data.exerciseId, tx);
  debug.info("adding exercise %s to block %s", data.exerciseId, blockId);

  return createExerciseEntryDb({
    targetSets: DEFAULT_TARGET_SETS,
    targetReps: DEFAULT_TARGET_REPS,
    targetWeight: DEFAULT_TARGET_WEIGHT,
    restSeconds: DEFAULT_REST_SECONDS,
    weightStep: DEFAULT_WEIGHT_STEP[ getSettings(tx).unit ],
    ...data,
    blockId,
    position: nextPosition(block.exerciseEntries)
  }, tx);
}

export function updateExerciseEntry(
  id: string,
  payload: ExerciseEntryUpdatePayload,
  tx?: TransactionType
): ExerciseEntryAttributes {
  const data = parseOrThrow(exerciseEntryUpdatePayloadSchema, payload);

  getExerciseEntry(id, tx);

  if (data.exerciseId) {
    getExercise(data.exerciseId, tx);
  }

  debug.info("updating exercise entry %s", id);

  return updateExerciseEntryDb(id, data, tx);
}

// Increase Next Time: raises the target weight by the entry's Weight Step, up
// to the cap. Nothing else about the entry changes.
export function raiseTargetWeight(id: string, tx?: TransactionType): ExerciseEntryAttributes {
  const entry = getExerciseEntry(id, tx);

  debug.info("raising target weight of exercise entry %s by %d", id, entry.weightStep);

  return updateExerciseEntryDb(id, { targetWeight: Math.min(MAX_TARGET_WEIGHT, entry.targetWeight + entry.weightStep) }, tx);
}

// A Block is made of its entries, so removing the last one removes the Block.
export function deleteExerciseEntry(id: string, tx?: TransactionType): void {
  inTransaction(tx, t => {
    const { blockId } = getExerciseEntry(id, t);

    debug.info("deleting exercise entry %s", id);
    deleteExerciseEntryDb(id, t);

    if (getLiveBlockOrThrow(blockId, t).exerciseEntries.length === 0) {
      deleteBlockDb(blockId, t);
    }
  });
}

// orderedIds lists every live entry in the Block, first to last.
export function reorderExerciseEntries(
  blockId: string,
  orderedIds: string[],
  tx?: TransactionType
): void {
  inTransaction(tx, t => {
    getLiveBlockOrThrow(blockId, t);

    const entries = getAllExerciseEntryByQuery({
      where: {
        blockId,
        deletedAt: { isNull: true }
      }
    }, t);

    for (const { id, position } of orderOrThrow(entries, orderedIds)) {
      updateExerciseEntryDb(id, { position }, t);
    }
  });
}
