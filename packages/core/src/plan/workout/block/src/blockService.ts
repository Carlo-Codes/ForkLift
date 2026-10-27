import { z } from "zod";

import { exerciseEntrySchema } from "@forklift/db/client";
import type {
  ExerciseCreatePayload, ExerciseEntryCreatePayload, TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { createExercise } from "#exercise/exerciseService";
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { write } from "#aiChange/aiChangeRecorder";
import { getWorkout } from "#workout/workoutService";
import { updateExerciseEntryDb } from "#exerciseEntry/exerciseEntryDb";
import { createExerciseEntry } from "#exerciseEntry/exerciseEntryService";

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
const ungroupedIdsSchema = z.array(z.uuid()).min(1, "Tick an Exercise Entry to ungroup");

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

// A Block as a Change by AI names it: its Exercises, "Bench Press" or "Cable
// Fly + Dip".
const namesOf = (block: BlockWithEntries) => block.exerciseEntries.map(e => e.exercise.name).join(" + ");
const workoutName = (workoutId: string, tx: TransactionType) => `Workout "${getWorkout(workoutId, tx).name}"`;

// Adds a straight-sets Block at the end of the Workout, holding one Exercise
// Entry built from entry.
export function createBlock(
  workoutId: string,
  entry: ExerciseEntryCreatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): BlockWithEntries {
  return write(actor, tx, t => {
    const { id } = createBlockDb({
      workoutId,
      position: nextPosition(listBlocks(workoutId, t))
    }, t);

    debug.info("created block %s in workout %s", id, workoutId);
    createExerciseEntry(id, entry, actor, t);

    return getBlock(id, t);
  }, (block, t) => `Added ${namesOf(block)} to ${workoutName(workoutId, t)}`);
}

// Where the Plan editor's Add exercise puts an Exercise: a new Block at the end
// of the Workout, or the Superset blockId names.
export interface AddExerciseTarget {
  workoutId: string;
  blockId?: string;
}

// Adds the Exercise with the default targets, returning the Block it's in.
export function addExerciseToWorkout(
  { workoutId, blockId }: AddExerciseTarget,
  exerciseId: string,
  tx?: TransactionType
): BlockWithEntries {
  return inTransaction(tx, t => {
    if (!blockId) {
      return createBlock(workoutId, { exerciseId }, "lifter", t);
    }

    createExerciseEntry(blockId, { exerciseId }, "lifter", t);

    return getBlock(blockId, t);
  });
}

// New exercise in the Plan editor's picker: the Exercise joins the library and
// the Workout together, or neither does.
export function createExerciseInWorkout(
  target: AddExerciseTarget,
  payload: ExerciseCreatePayload,
  tx?: TransactionType
): BlockWithEntries {
  return inTransaction(tx, t => addExerciseToWorkout(target, createExercise(payload, "lifter", t).id, t));
}

export function deleteBlock(id: string, actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    const block = getBlock(id, t);

    debug.info("deleting block %s", id);
    deleteBlockDb(id, t);

    return block;
  }, (block, t) => `Removed ${namesOf(block)} from ${workoutName(block.workoutId, t)}`);
}

// orderedIds lists every live Block in the Workout, first to last.
export function reorderBlocks(
  workoutId: string,
  orderedIds: string[],
  actor: Actor = "lifter",
  tx?: TransactionType
): void {
  write(actor, tx, t => {
    for (const { id, position } of orderOrThrow(listBlocks(workoutId, t), orderedIds)) {
      updateBlockDb(id, { position }, t);
    }
  }, (_, t) => `Reordered ${workoutName(workoutId, t)}`);
}

// The rows ticked in Select mode: whole Blocks, single Exercise Entries, or both.
const selectionSchema = z.object({
  blockIds: z.array(z.uuid()).default([]),
  exerciseEntryIds: z.array(z.uuid()).default([])
});

export type RowSelection = z.input<typeof selectionSchema>;

const unique = (ids: string[]) => new Set(ids).size === ids.length;

// The ids of the ticked Exercise Entries, a ticked Block standing for all of
// its own. Each row must be one of these Blocks' and ticked once.
function tickedEntryIds(
  blocks: BlockWithEntries[],
  { blockIds, exerciseEntryIds }: { blockIds: string[]; exerciseEntryIds: string[] }
): Set<string> {
  const byId = new Map(blocks.map(b => [ b.id, b ]));
  const entryIds = new Set(blocks.flatMap(b => b.exerciseEntries.map(e => e.id)));

  if (!unique(blockIds) || !unique(exerciseEntryIds) || !blockIds.every(id => byId.has(id)) || !exerciseEntryIds.every(id => entryIds.has(id))) {
    throw new ApiError(400, "Only rows of this Workout can be ticked, each once", "ValidationError");
  }

  return new Set([ ...exerciseEntryIds, ...blockIds.flatMap(id => byId.get(id)!.exerciseEntries.map(e => e.id)) ]);
}

// Numbers the Workout's Blocks in orderedIds' order, writing only the ones
// whose position changes.
function placeBlocks(blocks: BlockWithEntries[], orderedIds: string[], tx: TransactionType): void {
  const positions = new Map(blocks.map(b => [ b.id, b.position ]));

  orderedIds.forEach((id, position) => {
    if (positions.get(id) !== position) {
      updateBlockDb(id, { position }, tx);
    }
  });
}

// Create Superset in Select mode: the ticked rows become one Superset at the
// place of the top-most one, in their order in the Workout, wherever they
// were. A ticked Superset takes in the other rows and keeps its id; otherwise
// the top-most Block does if it's wholly ticked. Entries ticked out of a
// Superset leave the rest of it where it was, with the new Superset just after
// it when it's the top-most. The entries keep their ids and their rest.
export function createSuperset(
  workoutId: string,
  selection: RowSelection,
  actor: Actor = "lifter",
  tx?: TransactionType
): BlockWithEntries {
  const ticks = parseOrThrow(selectionSchema, selection);

  return write(actor, tx, t => {
    const blocks = listBlocks(workoutId, t);
    const ticked = tickedEntryIds(blocks, ticks);
    const entries = blocks.flatMap(b => b.exerciseEntries.filter(e => ticked.has(e.id)));

    if (entries.length < 2) {
      throw new ApiError(400, "A Superset needs at least two Exercise Entries", "ValidationError");
    }

    const whole = (block: BlockWithEntries) => block.exerciseEntries.every(e => ticked.has(e.id));
    const topIndex = blocks.findIndex(b => b.exerciseEntries.some(e => ticked.has(e.id)));
    const top = blocks[ topIndex ]!;
    const kept = blocks.find(b => whole(b) && b.exerciseEntries.length > 1) ?? (whole(top) ? top : undefined);

    // Placed below.
    const targetId = kept?.id ?? createBlockDb({
      workoutId,
      position: 0
    }, t).id;

    debug.info("grouping exercise entries %o into superset %s", entries.map(e => e.id), targetId);

    entries.forEach((entry, position) => {
      updateExerciseEntryDb(entry.id, {
        blockId: targetId,
        position
      }, t);
    });

    // Emptied by the move, so their entries stay live.
    for (const block of blocks.filter(b => whole(b) && b.id !== targetId)) {
      deleteBlockDb(block.id, t);
    }

    const order = blocks.filter(b => !whole(b)).map(b => b.id);

    order.splice(blocks.slice(0, topIndex).filter(b => !whole(b)).length + (whole(top) ? 0 : 1), 0, targetId);
    placeBlocks(blocks, order, t);

    return getBlock(targetId, t);
  }, (block, t) => `Made a Superset of ${namesOf(block)} in ${workoutName(workoutId, t)}`);
}

// Merges the named Blocks, which must sit next to each other in the Workout,
// into a Superset in the place of the first (see createSuperset).
export function groupBlocks(
  workoutId: string,
  blockIds: string[],
  actor: Actor = "lifter",
  tx?: TransactionType
): BlockWithEntries {
  const ids = parseOrThrow(groupedIdsSchema, blockIds);

  return inTransaction(tx, t => {
    const blocks = listBlocks(workoutId, t);
    const start = blocks.findIndex(b => ids.includes(b.id));
    const group = blocks.slice(start, start + ids.length);

    if (!unique(ids) || group.length !== ids.length || !group.every(b => ids.includes(b.id))) {
      throw new ApiError(400, "Only Blocks next to each other in this Workout can be grouped", "ValidationError");
    }

    return createSuperset(workoutId, { blockIds: ids }, actor, t);
  });
}

// Sets the Round Rest: the rest of every Exercise Entry in the Superset.
export function setRoundRest(
  id: string,
  restSeconds: number,
  actor: Actor = "lifter",
  tx?: TransactionType
): BlockWithEntries {
  const rest = parseOrThrow(exerciseEntrySchema.shape.restSeconds, restSeconds);

  return write(actor, tx, t => {
    debug.info("setting the round rest of block %s to %ds", id, rest);

    for (const entry of getBlock(id, t).exerciseEntries) {
      updateExerciseEntryDb(entry.id, { restSeconds: rest }, t);
    }

    return getBlock(id, t);
  }, (block, t) => `Set the Round Rest of ${namesOf(block)} in ${workoutName(block.workoutId, t)} to ${rest}s`);
}

// Ungroup in Select mode: each ticked Exercise Entry in a Superset becomes a
// Block of straight sets just after it, in order, and the rest of the
// Superset stays. With all of a Superset's entries ticked, the first stays in
// its Block. Ticked straight sets are already ungrouped. The entries keep
// their ids. Returns the Workout's Blocks as they are now.
export function ungroupExerciseEntries(
  workoutId: string,
  exerciseEntryIds: string[],
  actor: Actor = "lifter",
  tx?: TransactionType
): BlockWithEntries[] {
  const ids = parseOrThrow(ungroupedIdsSchema, exerciseEntryIds);
  const moved: string[] = [];

  return write(actor, tx, t => {
    const blocks = listBlocks(workoutId, t);

    const ticked = tickedEntryIds(blocks, {
      blockIds: [],
      exerciseEntryIds: ids
    });

    const order = blocks.flatMap(block => {
      const leaving = block.exerciseEntries.filter(e => ticked.has(e.id));

      if (block.exerciseEntries.length < 2 || leaving.length === 0) {
        return [ block.id ];
      }

      if (leaving.length === block.exerciseEntries.length) {
        leaving.shift();
      }

      debug.info("taking %d exercise entries out of superset %s", leaving.length, block.id);

      return [
        block.id,
        ...leaving.map(entry => {
          // Placed below.
          const { id } = createBlockDb({
            workoutId,
            position: 0
          }, t);

          updateExerciseEntryDb(entry.id, {
            blockId: id,
            position: 0
          }, t);
          moved.push(entry.exercise.name);

          return id;
        })
      ];
    });

    placeBlocks(blocks, order, t);

    return listBlocks(workoutId, t);
  }, (_, t) => `Took ${moved.join(" + ")} out of a Superset in ${workoutName(workoutId, t)}`);
}

// Splits a Superset into Blocks of straight sets, one per entry, in its place.
// The first entry stays in this Block and the entries keep their ids. Returns
// the resulting Blocks in order.
export function ungroupBlock(id: string, actor: Actor = "lifter", tx?: TransactionType): BlockWithEntries[] {
  return write(actor, tx, t => {
    const block = getBlock(id, t);
    const entryIds = new Set(block.exerciseEntries.map(e => e.id));

    debug.info("splitting superset %s", id);

    return ungroupExerciseEntries(block.workoutId, [ ...entryIds ], actor, t)
      .filter(b => b.exerciseEntries.some(e => entryIds.has(e.id)));
  }, (blocks, t) => `Split the Superset of ${blocks.map(namesOf).join(" + ")} in ${workoutName(blocks[ 0 ]!.workoutId, t)}`);
}
