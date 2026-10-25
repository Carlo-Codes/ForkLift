import type { z } from "zod";

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

import { builtInExercises } from "./builtInExercises";
import {
  createExerciseDb,
  deleteExerciseDb,
  getAllExerciseByQuery,
  getExerciseByQuery,
  updateExerciseDb
} from "./exerciseDb";

const debug = createDebugger("exerciseService");

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map(i => i.message).join("; "), "ValidationError");
  }

  return parsed.data;
}

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
  tx?: TransactionType
): ExerciseAttributes {
  const data = parseOrThrow(exerciseCreatePayloadSchema, payload);

  debug.info("creating exercise %s", data.name);

  return createExerciseDb({
    ...data,
    isBuiltIn: false
  }, tx);
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
  tx?: TransactionType
): ExerciseAttributes {
  const data = parseOrThrow(exerciseUpdatePayloadSchema, payload);

  getExercise(id, tx);
  debug.info("updating exercise %s", id);

  return updateExerciseDb(id, data, tx);
}

export function deleteExercise(id: string, tx?: TransactionType): void {
  getExercise(id, tx);
  debug.info("deleting exercise %s", id);
  deleteExerciseDb(id, tx);
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
