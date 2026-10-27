import {
  DEFAULT_REST_SECONDS,
  DEFAULT_TARGET_REPS,
  DEFAULT_TARGET_SETS,
  DEFAULT_TARGET_WEIGHT,
  DEFAULT_WEIGHT_STEP,
  exerciseEntryCreatePayloadSchema,
  exerciseEntrySchema,
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

import {
  nextPosition, orderOrThrow, slotIn
} from "#utils/position";
import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { write } from "#aiChange/aiChangeRecorder";
import { getExerciseByQuery } from "#exercise/exerciseDb";
import { getExercise } from "#exercise/exerciseService";
import { getSettings } from "#setting/settingService";
import { getWorkoutByQuery } from "#workout/workoutDb";
import {
  deleteBlockDb, getAllBlockByQuery, getBlockByQuery, updateBlockDb
} from "#block/blockDb";

import {
  createExerciseEntryDb,
  deleteExerciseEntryDb,
  getAllExerciseEntryByQuery,
  getExerciseEntryByQuery,
  updateExerciseEntryDb
} from "./exerciseEntryDb";

const debug = createDebugger("exerciseEntryService");

const rangeOf = ({ minValue, maxValue }: { minValue: number | null; maxValue: number | null }) => ({
  min: minValue ?? 0,
  max: maxValue ?? Number.MAX_SAFE_INTEGER
});

const { shape } = exerciseEntrySchema;
const WEIGHT_STEP_STEP = 0.25;

// Each target's range, as core checks it, and how far a stepper moves it. The
// target weight steps by the entry's own Weight Step. A Weight Step must be
// above 0, so its range starts one step up.
export const EXERCISE_ENTRY_BOUNDS = {
  targetSets: {
    ...rangeOf(shape.targetSets),
    step: 1
  },
  targetReps: {
    ...rangeOf(shape.targetReps),
    step: 1
  },
  targetWeight: rangeOf(shape.targetWeight),
  restSeconds: {
    ...rangeOf(shape.restSeconds),
    step: 15
  },
  weightStep: {
    min: WEIGHT_STEP_STEP,
    max: rangeOf(shape.weightStep).max,
    step: WEIGHT_STEP_STEP
  }
} as const;

// What Undo needs to put a removed entry back: whether removing it took its
// Block too, so a Block deleted any other way stays deleted.
export interface ExerciseEntryRemoval {
  exerciseEntryId: string;
  blockRemoved: boolean;
}

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

function workoutNameOf(blockId: string, tx: TransactionType): string {
  const block = getBlockByQuery({ where: { id: blockId } }, tx);
  const workout = block && getWorkoutByQuery({ where: { id: block.workoutId } }, tx);

  return `Workout "${workout?.name ?? ""}"`;
}

const exerciseName = (exerciseId: string, tx: TransactionType) => getExerciseByQuery({ where: { id: exerciseId } }, tx)?.name ?? "";

// How a Change by AI names each target.
const TARGET_LABELS = {
  targetSets: "sets",
  targetReps: "reps",
  targetWeight: "weight",
  restSeconds: "rest",
  weightStep: "Weight Step"
} as const;

type Target = keyof typeof TARGET_LABELS;

// What an update changed, as a Change by AI words it, e.g. "sets 3 → 4,
// weight 60kg → 62.5kg".
function describeChanges(
  before: ExerciseEntryAttributes,
  after: ExerciseEntryAttributes,
  tx: TransactionType
): string {
  const { unit } = getSettings(tx);

  const suffix: Partial<Record<Target, string>> = {
    targetWeight: unit,
    restSeconds: "s",
    weightStep: unit
  };

  const changes = (Object.keys(TARGET_LABELS) as Target[])
    .filter(key => before[ key ] !== after[ key ])
    .map(key => `${TARGET_LABELS[ key ]} ${before[ key ]}${suffix[ key ] ?? ""} → ${after[ key ]}${suffix[ key ] ?? ""}`);

  if (before.exerciseId !== after.exerciseId) {
    changes.unshift(`Exercise ${exerciseName(before.exerciseId, tx)} → ${exerciseName(after.exerciseId, tx)}`);
  }

  return changes.join(", ");
}

// The Round Rest: the longest rest among a Superset's Exercise Entries, or
// undefined for none.
export function roundRest(entries: Pick<ExerciseEntryAttributes, "restSeconds">[]): number | undefined {
  return entries.length > 0 ? Math.max(...entries.map(e => e.restSeconds)) : undefined;
}

// Adds an entry at the end of the Block. Targets the lifter leaves out take the
// defaults, the Weight Step the one for the current unit, and the rest the
// Block's Round Rest when it already has entries.
export function createExerciseEntry(
  blockId: string,
  payload: ExerciseEntryCreatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): ExerciseEntryAttributes {
  const data = parseOrThrow(exerciseEntryCreatePayloadSchema, payload);
  let others: string[] = [];

  return write(actor, tx, t => {
    const block = getLiveBlockOrThrow(blockId, t);

    others = block.exerciseEntries.map(e => e.exercise.name);
    getExercise(data.exerciseId, t);
    debug.info("adding exercise %s to block %s", data.exerciseId, blockId);

    return createExerciseEntryDb({
      targetSets: DEFAULT_TARGET_SETS,
      targetReps: DEFAULT_TARGET_REPS,
      targetWeight: DEFAULT_TARGET_WEIGHT,
      restSeconds: roundRest(block.exerciseEntries) ?? DEFAULT_REST_SECONDS,
      weightStep: DEFAULT_WEIGHT_STEP[ getSettings(t).unit ],
      ...data,
      blockId,
      position: nextPosition(block.exerciseEntries)
    }, t);
  }, (entry, t) => `Added ${exerciseName(entry.exerciseId, t)} to a Superset with ${others.join(" + ")} in ${workoutNameOf(blockId, t)}`);
}

export function updateExerciseEntry(
  id: string,
  payload: ExerciseEntryUpdatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): ExerciseEntryAttributes {
  const data = parseOrThrow(exerciseEntryUpdatePayloadSchema, payload);
  let before!: ExerciseEntryAttributes;

  return write(actor, tx, t => {
    before = getExerciseEntry(id, t);

    if (data.exerciseId) {
      getExercise(data.exerciseId, t);
    }

    debug.info("updating exercise entry %s", id);

    return updateExerciseEntryDb(id, data, t);
  }, (entry, t) => `Changed ${exerciseName(before.exerciseId, t)} in ${workoutNameOf(entry.blockId, t)}: ${describeChanges(before, entry, t)}`);
}

// Increase Next Time: raises the target weight by the entry's Weight Step, up
// to the cap. Nothing else about the entry changes. Part of finishing a
// Session, so the lifter's alone.
export function raiseTargetWeight(id: string, tx?: TransactionType): ExerciseEntryAttributes {
  const entry = getExerciseEntry(id, tx);

  debug.info("raising target weight of exercise entry %s by %d", id, entry.weightStep);

  return updateExerciseEntryDb(id, { targetWeight: Math.min(MAX_TARGET_WEIGHT, entry.targetWeight + entry.weightStep) }, tx);
}

// A Block is made of its entries, so removing the last one removes the Block.
// Returns what restoreExerciseEntry needs to undo it.
export function deleteExerciseEntry(id: string, actor: Actor = "lifter", tx?: TransactionType): ExerciseEntryRemoval {
  const { entry, blockRemoved } = write(actor, tx, t => {
    const removed = getExerciseEntry(id, t);

    debug.info("deleting exercise entry %s", id);
    deleteExerciseEntryDb(id, t);

    const emptied = getLiveBlockOrThrow(removed.blockId, t).exerciseEntries.length === 0;

    if (emptied) {
      deleteBlockDb(removed.blockId, t);
    }

    return {
      entry: removed,
      blockRemoved: emptied
    };
  }, (result, t) => `Removed ${exerciseName(result.entry.exerciseId, t)} from ${workoutNameOf(result.entry.blockId, t)}`);

  return {
    exerciseEntryId: entry.id,
    blockRemoved
  };
}

// Undo of the lifter removing an entry: it goes back in its place, along with
// its Block if removing it took the Block too, ahead of whatever has taken
// that place since. Only while its Workout is still there, and its Block too
// unless the removal took it. The AI's removals are undone through Changes by
// AI instead.
export function restoreExerciseEntry(
  { exerciseEntryId: id, blockRemoved }: ExerciseEntryRemoval,
  tx?: TransactionType
): ExerciseEntryAttributes {
  return inTransaction(tx, t => {
    const entry = getExerciseEntryByQuery({ where: { id } }, t);
    const block = entry && getBlockByQuery({ where: { id: entry.blockId } }, t);

    const workout = block && getWorkoutByQuery({
      where: {
        id: block.workoutId,
        deletedAt: { isNull: true }
      }
    }, t);

    // A Block deleted some other way since (e.g. the AI's delete_block) stays
    // deleted, and the entry with it.
    if (!entry || !block || !workout || (block.deletedAt && !blockRemoved)) {
      throw new ApiError(404, `Exercise entry ${id} not found`, "NotFoundError");
    }

    if (!entry.deletedAt) {
      return entry;
    }

    debug.info("restoring exercise entry %s", id);

    if (block.deletedAt) {
      const blocks = getAllBlockByQuery({
        where: {
          workoutId: block.workoutId,
          deletedAt: { isNull: true }
        }
      }, t);

      for (const { id: blockId, position } of slotIn(blocks, block)) {
        updateBlockDb(blockId, { position }, t);
      }

      updateBlockDb(block.id, { deletedAt: null }, t);
    }

    const entries = getAllExerciseEntryByQuery({
      where: {
        blockId: block.id,
        deletedAt: { isNull: true }
      }
    }, t);

    for (const { id: entryId, position } of slotIn(entries, entry)) {
      updateExerciseEntryDb(entryId, { position }, t);
    }

    return updateExerciseEntryDb(id, { deletedAt: null }, t);
  });
}

// The lifter's Remove (a row's, or Select mode's for several): removes every
// named entry, or none of them. Returns what restoreExerciseEntries needs to
// undo them all at once.
export function deleteExerciseEntries(ids: string[], tx?: TransactionType): ExerciseEntryRemoval[] {
  return inTransaction(tx, t => ids.map(id => deleteExerciseEntry(id, "lifter", t)));
}

// Undo of deleteExerciseEntries: every entry goes back in its place (see
// restoreExerciseEntry), or none does. They go back last-removed first, so a
// Block the last of its entries took with it is back before the others return.
export function restoreExerciseEntries(
  removals: ExerciseEntryRemoval[],
  tx?: TransactionType
): ExerciseEntryAttributes[] {
  return inTransaction(tx, t => removals.toReversed().map(removal => restoreExerciseEntry(removal, t))
    .reverse());
}

// orderedIds lists every live entry in the Block, first to last.
export function reorderExerciseEntries(
  blockId: string,
  orderedIds: string[],
  actor: Actor = "lifter",
  tx?: TransactionType
): void {
  write(actor, tx, t => {
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
  }, (_, t) => `Reordered a Superset in ${workoutNameOf(blockId, t)}`);
}
