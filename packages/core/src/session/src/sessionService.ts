import { completeSetPayloadSchema } from "@forklift/db/client";
import type {
  CompleteSetPayload,
  SessionAttributes,
  SessionEntrySnapshot,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { advanceRotation } from "../../plan/src/planService";
import { listBlocks } from "../../plan/workout/block/src/blockService";
import { inTransaction } from "../../utils/transaction";
import { parseOrThrow } from "../../utils/validation";
import { createLoggedSetDb } from "../loggedSet/src/loggedSetDb";
import { listLoggedSets } from "../loggedSet/src/loggedSetService";
import {
  createSessionDb, getSessionByQuery, updateSessionDb
} from "./sessionDb";

const debug = createDebugger("sessionService");

// One set of the Session, in the order Workout Mode runs them.
export interface SessionSet {
  exerciseEntryId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  targetReps: number;
  targetWeight: number;
}

// Where Workout Mode stands: the set to do now (none once every set is logged),
// the one after it, and the rest due before the current set, counted from when
// the last set was logged.
export interface SessionStep {
  session: SessionAttributes;
  current?: SessionSet;
  next?: SessionSet;
  rest?: { seconds: number; endsAt: Date };
}

type OrderedSet = SessionSet & { restAfter: number };

// Set ordering lives here, not in the UI: Blocks in order, and within a Block
// each Exercise Entry's sets in turn, resting after each set but the last.
function orderSets(blocks: SessionEntrySnapshot[][]): OrderedSet[] {
  const sets = blocks.flatMap(entries => entries.flatMap(entry => Array.from({ length: entry.targetSets }, (_, i) => ({
    exerciseEntryId: entry.exerciseEntryId,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    setNumber: i + 1,
    totalSets: entry.targetSets,
    targetReps: entry.targetReps,
    targetWeight: entry.targetWeight,
    restAfter: entry.restSeconds
  }))));

  return sets.map((set, i) => (i === sets.length - 1 ? {
    ...set,
    restAfter: 0
  } : set));
}

function setKey(exerciseEntryId: string, setNumber: number): string {
  return `${exerciseEntryId}:${setNumber}`;
}

function toSessionSet(set: OrderedSet | undefined): SessionSet | undefined {
  if (!set) {
    return undefined;
  }

  const { restAfter: _, ...rest } = set;

  return rest;
}

function assertInProgress(session: SessionAttributes): void {
  if (session.status !== "inProgress") {
    throw new ApiError(409, "This Session is already finished", "ConflictError");
  }
}

export function getSession(id: string, tx?: TransactionType): SessionAttributes {
  const session = getSessionByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!session) {
    throw new ApiError(404, `Session ${id} not found`, "NotFoundError");
  }

  return session;
}

// Starts a Session of the Workout with its targets snapshotted, so edits to the
// Workout from here on apply from the next Session.
export function startSession(workoutId: string, tx?: TransactionType): SessionAttributes {
  return inTransaction(tx, t => {
    const blocks = listBlocks(workoutId, t).map(block => block.exerciseEntries.map(entry => ({
      exerciseEntryId: entry.id,
      exerciseId: entry.exerciseId,
      exerciseName: entry.exercise.name,
      targetSets: entry.targetSets,
      targetReps: entry.targetReps,
      targetWeight: entry.targetWeight,
      restSeconds: entry.restSeconds
    })));

    if (blocks.length === 0) {
      throw new ApiError(400, "Add an exercise to this Workout before starting it", "ValidationError");
    }

    debug.info("starting session of workout %s", workoutId);

    return createSessionDb({
      workoutId,
      status: "inProgress",
      blocks,
      startedAt: new Date()
    }, t);
  });
}

export function getCurrentStep(sessionId: string, tx?: TransactionType): SessionStep {
  const session = getSession(sessionId, tx);
  const loggedSets = listLoggedSets(sessionId, tx);
  const logged = new Set(loggedSets.map(s => setKey(s.exerciseEntryId, s.round)));
  const sets = orderSets(session.blocks);
  const index = sets.findIndex(s => !logged.has(setKey(s.exerciseEntryId, s.setNumber)));
  const last = loggedSets.at(-1);
  const restAfterLast = last && sets.find(s => setKey(s.exerciseEntryId, s.setNumber) === setKey(last.exerciseEntryId, last.round))?.restAfter;

  return {
    session,
    current: toSessionSet(sets[ index ]),
    next: index === -1 ? undefined : toSessionSet(sets[ index + 1 ]),
    rest: index !== -1 && last && restAfterLast ? {
      seconds: restAfterLast,
      endsAt: new Date(last.completedAt.getTime() + restAfterLast * 1000)
    } : undefined
  };
}

// Done: logs the current set, as planned unless the lifter changed the reps or
// weight, and returns the step after it.
export function completeSet(
  sessionId: string,
  payload: CompleteSetPayload = {},
  tx?: TransactionType
): SessionStep {
  const data = parseOrThrow(completeSetPayloadSchema, payload);

  return inTransaction(tx, t => {
    const { session, current } = getCurrentStep(sessionId, t);

    assertInProgress(session);

    if (!current) {
      throw new ApiError(409, "Every set in this Session is done", "ConflictError");
    }

    debug.info("completing set %d of entry %s in session %s", current.setNumber, current.exerciseEntryId, sessionId);

    createLoggedSetDb({
      sessionId,
      exerciseEntryId: current.exerciseEntryId,
      exerciseId: current.exerciseId,
      round: current.setNumber,
      reps: data.reps ?? current.targetReps,
      weight: data.weight ?? current.targetWeight,
      completedAt: new Date()
    }, t);

    return getCurrentStep(sessionId, t);
  });
}

// Saves the Session as finished and moves its Plan's rotation on, together.
export function finishSession(sessionId: string, tx?: TransactionType): SessionAttributes {
  return inTransaction(tx, t => {
    const session = getSession(sessionId, t);

    assertInProgress(session);
    debug.info("finishing session %s", sessionId);
    advanceRotation(session.workoutId, t);

    return updateSessionDb(sessionId, {
      status: "finished",
      finishedAt: new Date()
    }, t);
  });
}
