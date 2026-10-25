import { completeSetPayloadSchema } from "@forklift/db/client";
import type {
  CompleteSetPayload,
  SessionAttributes,
  SessionEntrySnapshot,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";

import { advanceRotation } from "../../plan/src/planService";
import { listBlocks } from "../../plan/workout/block/src/blockService";
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
  // Only in a Superset: the entry's letter (A, B, …), the round, and where the
  // set falls among the entries still in that round (e.g. "A2 · Superset 1/2").
  superset?: {
    letter: string;
    round: number;
    position: number;
    roundSize: number;
  };
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

// Set ordering lives here, not in the UI: Blocks in order, each run in rounds of
// one set per Exercise Entry still to go, so straight sets are rounds of one and
// a Superset goes A1 → B1 → rest → A2 → B2, an entry dropping out once its sets
// are done. Rest follows each round, for the longest rest among its entries.
function orderSets(blocks: SessionEntrySnapshot[][]): OrderedSet[] {
  const sets = blocks.flatMap(entries => {
    const rounds = Math.max(...entries.map(entry => entry.targetSets));

    return Array.from({ length: rounds }, (_, i) => {
      const round = entries.filter(entry => entry.targetSets > i);
      const roundRest = Math.max(...round.map(entry => entry.restSeconds));

      return round.map((entry, position) => ({
        exerciseEntryId: entry.exerciseEntryId,
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        setNumber: i + 1,
        totalSets: entry.targetSets,
        targetReps: entry.targetReps,
        targetWeight: entry.targetWeight,
        restAfter: position === round.length - 1 ? roundRest : 0,
        ...(entries.length > 1 && {
          superset: {
            letter: String.fromCharCode(65 + entries.indexOf(entry)),
            round: i + 1,
            position: position + 1,
            roundSize: round.length
          }
        })
      }));
    }).flat();
  });

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

  // Sets logged in the same millisecond tie on completedAt, so the one the rest
  // follows is the latest of those in Session order.
  const restAfterLast = last && sets.findLast(s => loggedSets.some(l => l.completedAt.getTime() === last.completedAt.getTime() &&
    setKey(l.exerciseEntryId, l.round) === setKey(s.exerciseEntryId, s.setNumber)))?.restAfter;

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
