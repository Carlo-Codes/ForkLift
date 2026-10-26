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
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { write } from "#aiChange/aiChangeRecorder";
import { getExerciseByQuery } from "#exercise/exerciseDb";
import { getExercise } from "#exercise/exerciseService";
import { getSettings } from "#setting/settingService";
import { getWorkoutByQuery } from "#workout/workoutDb";
import { deleteBlockDb, getBlockByQuery } from "#block/blockDb";

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

// Adds an entry at the end of the Block. Targets the lifter leaves out take the
// defaults, the Weight Step the one for the current unit.
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
      restSeconds: DEFAULT_REST_SECONDS,
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
export function deleteExerciseEntry(id: string, actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    const entry = getExerciseEntry(id, t);

    debug.info("deleting exercise entry %s", id);
    deleteExerciseEntryDb(id, t);

    if (getLiveBlockOrThrow(entry.blockId, t).exerciseEntries.length === 0) {
      deleteBlockDb(entry.blockId, t);
    }

    return entry;
  }, (entry, t) => `Removed ${exerciseName(entry.exerciseId, t)} from ${workoutNameOf(entry.blockId, t)}`);
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
