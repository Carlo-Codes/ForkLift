import {
  exerciseCreatePayloadSchema, exerciseUpdatePayloadSchema, getDb, sql
} from "@forklift/db/client";
import type {
  ExerciseAttributes,
  ExerciseCreatePayload,
  ExerciseUpdatePayload,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { parseOrThrow } from "#utils/validation";

import type { Actor } from "../../aiChange/src/aiChangeRecorder";
import { write } from "../../aiChange/src/aiChangeRecorder";
import { builtInExercises } from "./builtInExercises";
import {
  createExerciseDb,
  deleteExerciseDb,
  getAllExerciseByQuery,
  getExerciseByQuery,
  updateExerciseDb
} from "./exerciseDb";

const debug = createDebugger("exerciseService");

export function listExercises(tx?: TransactionType): ExerciseAttributes[] {
  return searchExercises("", tx);
}

// Case-insensitive match anywhere in the name; % and _ in the query are literal.
export function searchExercises(query: string, tx?: TransactionType): ExerciseAttributes[] {
  const pattern = `%${query.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;

  return getAllExerciseByQuery({
    where: {
      deletedAt: { isNull: true },
      RAW: t => sql`${t.name} LIKE ${pattern} ESCAPE '\\'`
    }
  }, tx);
}

export function createExercise(
  payload: ExerciseCreatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): ExerciseAttributes {
  const data = parseOrThrow(exerciseCreatePayloadSchema, payload);

  return write(actor, tx, t => {
    debug.info("creating exercise %s", data.name);

    return createExerciseDb({
      ...data,
      isBuiltIn: false
    }, t);
  }, exercise => `Added "${exercise.name}" to the Exercise Library`);
}

// Soft-deleted Exercises are gone as far as the lifter is concerned.
export function getExercise(id: string, tx?: TransactionType): ExerciseAttributes {
  const exercise = getExerciseByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!exercise) {
    throw new ApiError(404, `Exercise ${id} not found`, "NotFoundError");
  }

  return exercise;
}

export function updateExercise(
  id: string,
  payload: ExerciseUpdatePayload,
  actor: Actor = "lifter",
  tx?: TransactionType
): ExerciseAttributes {
  const data = parseOrThrow(exerciseUpdatePayloadSchema, payload);
  let was = "";

  return write(actor, tx, t => {
    was = getExercise(id, t).name;
    debug.info("updating exercise %s", id);

    return updateExerciseDb(id, data, t);
  }, exercise => (exercise.name === was ? `Edited Exercise "${was}"` : `Renamed Exercise "${was}" to "${exercise.name}"`));
}

// Entries and Logged Sets keep the Exercise, so they still have a name.
export function deleteExercise(id: string, actor: Actor = "lifter", tx?: TransactionType): void {
  write(actor, tx, t => {
    const exercise = getExercise(id, t);

    debug.info("deleting exercise %s", id);
    deleteExerciseDb(id, t);

    return exercise;
  }, exercise => `Deleted "${exercise.name}" from the Exercise Library`);
}

// Runs on every launch but loads the built-ins only into a library that has never
// had them. Soft-deleted built-ins still count, so the lifter's deletions and edits
// stick.
export function loadBuiltInExercises(): void {
  getDb().transaction(tx => {
    if (getExerciseByQuery({ where: { isBuiltIn: true } }, tx)) {
      return;
    }

    debug.info("loading %d built-in exercises", builtInExercises.length);

    for (const exercise of builtInExercises) {
      createExerciseDb({
        ...parseOrThrow(exerciseCreatePayloadSchema, exercise),
        isBuiltIn: true
      }, tx);
    }
  });
}
