import type { ExerciseEntryCreatePayload, TransactionType } from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "../../../../utils/position";
import { inTransaction } from "../../../../utils/transaction";
import { getWorkout } from "../../src/workoutService";
import { createExerciseEntry } from "../exerciseEntry/src/exerciseEntryService";
import type { BlockWithEntries } from "./blockDb";
import {
  createBlockDb,
  deleteBlockDb,
  getAllBlockByQuery,
  getBlockByQuery,
  updateBlockDb
} from "./blockDb";

const debug = createDebugger("blockService");

export function listBlocks(workoutId: string, tx?: TransactionType): BlockWithEntries[] {
  getWorkout(workoutId, tx);

  return getAllBlockByQuery({
    where: {
      workoutId,
      deletedAt: { isNull: true }
    }
  }, tx);
}

export function getBlock(id: string, tx?: TransactionType): BlockWithEntries {
  const block = getBlockByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!block) {
    throw new ApiError(404, `Block ${id} not found`, "NotFoundError");
  }

  return block;
}

// Adds a straight-sets Block at the end of the Workout, holding one Exercise
// Entry built from entry.
export function createBlock(
  workoutId: string,
  entry: ExerciseEntryCreatePayload,
  tx?: TransactionType
): BlockWithEntries {
  return inTransaction(tx, t => {
    const { id } = createBlockDb({
      workoutId,
      position: nextPosition(listBlocks(workoutId, t))
    }, t);

    debug.info("created block %s in workout %s", id, workoutId);
    createExerciseEntry(id, entry, t);

    return getBlock(id, t);
  });
}

export function deleteBlock(id: string, tx?: TransactionType): void {
  inTransaction(tx, t => {
    getBlock(id, t);
    debug.info("deleting block %s", id);
    deleteBlockDb(id, t);
  });
}

// orderedIds lists every live Block in the Workout, first to last.
export function reorderBlocks(workoutId: string, orderedIds: string[], tx?: TransactionType): void {
  inTransaction(tx, t => {
    for (const { id, position } of orderOrThrow(listBlocks(workoutId, t), orderedIds)) {
      updateBlockDb(id, { position }, t);
    }
  });
}
