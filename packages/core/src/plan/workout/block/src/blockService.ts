import { z } from "zod";

import type { ExerciseEntryCreatePayload, TransactionType } from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "../../../../utils/position";
import { inTransaction } from "../../../../utils/transaction";
import { parseOrThrow } from "../../../../utils/validation";
import { getWorkout } from "../../src/workoutService";
import { updateExerciseEntryDb } from "../exerciseEntry/src/exerciseEntryDb";
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
const groupedIdsSchema = z.array(z.uuid()).min(2, "A Superset needs at least two Blocks");

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

// Merges the named Blocks, which must sit next to each other in the Workout,
// into a Superset in the place of the first. Their entries keep their ids and
// their order, Block by Block; the other Blocks are deleted.
export function groupBlocks(workoutId: string, blockIds: string[], tx?: TransactionType): BlockWithEntries {
  const ids = parseOrThrow(groupedIdsSchema, blockIds);

  return inTransaction(tx, t => {
    const blocks = listBlocks(workoutId, t);
    const start = blocks.findIndex(b => ids.includes(b.id));
    const group = blocks.slice(start, start + ids.length);

    if (new Set(ids).size !== ids.length || group.length !== ids.length || !group.every(b => ids.includes(b.id))) {
      throw new ApiError(400, "Only Blocks next to each other in this Workout can be grouped", "ValidationError");
    }

    const [ target, ...rest ] = group;
    const entries = group.flatMap(b => b.exerciseEntries);

    debug.info("grouping blocks %o into a superset", ids);

    entries.forEach((entry, position) => {
      updateExerciseEntryDb(entry.id, {
        blockId: target!.id,
        position
      }, t);
    });

    // Emptied by the move, so their entries stay live.
    for (const block of rest) {
      deleteBlockDb(block.id, t);
    }

    return getBlock(target!.id, t);
  });
}

// Splits a Superset into Blocks of straight sets, one per entry, in its place.
// The first entry stays in this Block and the entries keep their ids. Returns
// the resulting Blocks in order.
export function ungroupBlock(id: string, tx?: TransactionType): BlockWithEntries[] {
  return inTransaction(tx, t => {
    const block = getBlock(id, t);
    const [ first, ...rest ] = block.exerciseEntries;

    if (!first || rest.length === 0) {
      return [ block ];
    }

    debug.info("splitting superset %s", id);

    const splitIds = [
      id,
      ...rest.map(entry => {
        // Placed by the reorder below.
        const { id: newId } = createBlockDb({
          workoutId: block.workoutId,
          position: 0
        }, t);

        updateExerciseEntryDb(entry.id, {
          blockId: newId,
          position: 0
        }, t);

        return newId;
      })
    ];

    // The new Blocks sit right after this one.
    reorderBlocks(block.workoutId, listBlocks(block.workoutId, t)
      .map(b => b.id)
      .filter(blockId => blockId === id || !splitIds.includes(blockId))
      .flatMap(blockId => (blockId === id ? splitIds : [ blockId ])), t);

    return splitIds.map(blockId => getBlock(blockId, t));
  });
}
