import { completeSetPayloadSchema, sessionIncreaseSchema } from "@forklift/db/client";
import type {
  CompleteSetPayload,
  SessionAttributes,
  SessionEntrySnapshot,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { inTransaction } from "#utils/transaction";
import { parseOrThrow } from "#utils/validation";
import type { Actor } from "#aiChange/aiChangeRecorder";
import { refuseAi } from "#aiChange/aiChangeRecorder";
import { getLastTime } from "#history/historyService";
import type { LastTime } from "#history/historyService";
import { advanceRotation } from "#plan/planService";
import { getExerciseEntryByQuery } from "#exerciseEntry/exerciseEntryDb";
import { raiseTargetWeight } from "#exerciseEntry/exerciseEntryService";
import { listBlocks } from "#block/blockService";
import { createLoggedSetDb } from "#loggedSet/loggedSetDb";
import { listLoggedSets } from "#loggedSet/loggedSetService";
import {
  createSessionIncreaseDb, getSessionIncreaseByQuery, updateSessionIncreaseDb
} from "#sessionIncrease/sessionIncreaseDb";
import { listIncreases } from "#sessionIncrease/sessionIncreaseService";

import {
  createSessionDb, getAllSessionByQuery, getSessionByQuery, updateSessionDb
} from "./sessionDb";

const debug = createDebugger("sessionService");
// Sessions are history, so only the lifter writes them (ADR-0002).
const refuseAiSessionWrite = (actor: Actor) => refuseAi(actor, "The AI can't change Sessions or Logged Sets");

const setIncreasePayloadSchema = sessionIncreaseSchema.pick({
  exerciseEntryId: true,
  enabled: true
});

// One set of the Session, in the order Workout Mode runs them.
export interface SessionSet {
  exerciseEntryId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  targetReps: number;
  targetWeight: number;
  superset?: SupersetPosition;
}

// Where a Superset set falls: its Exercise Entry's letter (A, B, …) and its place
// among the Exercise Entries still in the round. With setNumber as the round,
// Workout Mode shows e.g. "A2 · Superset 1/2".
export interface SupersetPosition {
  letter: string;
  position: number;
  roundSize: number;
}

// Where Workout Mode stands: the set to do now (none once every set is logged),
// the one after it, the rest due before the current set, counted from when the
// last set was logged, what the current set's entry did last time, and the
// Exercise Entries with Increase Next Time on.
export interface SessionStep {
  session: SessionAttributes;
  increases: string[];
  current?: SessionSet;
  lastTime?: LastTime;
  next?: SessionSet;
  rest?: { seconds: number; endsAt: Date };
}

type OrderedSet = SessionSet & { restAfter: number };

// Set ordering lives here, not in the UI: Blocks in order, each run in rounds of
// one set per Exercise Entry still to go, so straight sets are rounds of one and
// a Superset goes A1 → B1 → rest → A2 → B2, an Exercise Entry dropping out once
// its sets are done. Skipped sets drop out the same way, so the rounds and rest
// fit what's left. Rest follows each round, for the longest rest among its entries.
function orderSets(blocks: SessionEntrySnapshot[][], skipped: Set<string>): OrderedSet[] {
  const sets = blocks.flatMap(entries => {
    const rounds = Math.max(...entries.map(entry => entry.targetSets));

    return Array.from({ length: rounds }, (_, i) => {
      const round = entries.filter(entry => entry.targetSets > i && !skipped.has(setKey(entry.exerciseEntryId, i + 1)));

      if (round.length === 0) {
        return [];
      }

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
            letter: String.fromCharCode("A".charCodeAt(0) + entries.indexOf(entry)),
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

// Newest first, should an older Session ever be left in progress too.
function getInProgressSession(tx?: TransactionType): SessionAttributes | undefined {
  return getAllSessionByQuery({
    where: {
      status: "inProgress",
      deletedAt: { isNull: true }
    },
    pagination: {
      orderBy: { startedAt: "desc" },
      offset: 0,
      limit: 1
    }
  }, tx)[ 0 ];
}

// The step of the Session in progress, if there is one, for "Resume workout".
// Every tap is saved as it happens, so this is the exact set the lifter was on.
export function resumeSession(tx?: TransactionType): SessionStep | undefined {
  const session = getInProgressSession(tx);

  return session && getCurrentStep(session.id, tx);
}

// Starts a Session of the Workout with its targets snapshotted, so edits to the
// Workout from here on apply from the next Session.
export function startSession(workoutId: string, actor: Actor = "lifter", tx?: TransactionType): SessionAttributes {
  refuseAiSessionWrite(actor);

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

    if (getInProgressSession(t)) {
      throw new ApiError(409, "Finish the workout in progress before starting another", "ConflictError");
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
  const skipped = new Set(loggedSets.filter(s => s.skipped).map(s => setKey(s.exerciseEntryId, s.round)));
  const doneSets = loggedSets.filter(s => !s.skipped);
  const done = new Set(doneSets.map(s => setKey(s.exerciseEntryId, s.round)));
  const sets = orderSets(session.blocks, skipped);
  const index = sets.findIndex(s => !done.has(setKey(s.exerciseEntryId, s.setNumber)));
  // Rest follows the last set really done; skipping a set adds none.
  const last = doneSets.at(-1);

  // Sets logged in the same millisecond tie on completedAt, so the one the rest
  // follows is the latest of those in Session order.
  const doneLast = new Set(doneSets.filter(s => s.completedAt.getTime() === last?.completedAt.getTime())
    .map(s => setKey(s.exerciseEntryId, s.round)));

  const restAfterLast = sets.findLast(s => doneLast.has(setKey(s.exerciseEntryId, s.setNumber)))?.restAfter;
  // A rest the lifter skipped stays skipped until the next set is done.
  const restSkipped = last && session.restSkippedAfter?.getTime() === last.completedAt.getTime();

  return {
    session,
    increases: listIncreases(sessionId, tx),
    current: toSessionSet(sets[ index ]),
    lastTime: sets[ index ] && getLastTime(sets[ index ], tx),
    next: index === -1 ? undefined : toSessionSet(sets[ index + 1 ]),
    rest: index !== -1 && last && restAfterLast && !restSkipped ? {
      seconds: restAfterLast,
      endsAt: new Date(last.completedAt.getTime() + restAfterLast * 1000)
    } : undefined
  };
}

// The set Workout Mode is on, in a Session still in progress.
function getOpenStep(sessionId: string, tx: TransactionType): SessionStep & { current: SessionSet } {
  const step = getCurrentStep(sessionId, tx);

  assertInProgress(step.session);

  if (!step.current) {
    throw new ApiError(409, "Every set in this Session is done", "ConflictError");
  }

  return {
    ...step,
    current: step.current
  };
}

// Logs a set of the Session: done with the reps and weight given, or skipped.
function logSet(
  sessionId: string,
  set: SessionSet,
  done: { reps: number; weight: number } | "skipped",
  completedAt: Date,
  tx: TransactionType
): void {
  createLoggedSetDb({
    sessionId,
    exerciseEntryId: set.exerciseEntryId,
    exerciseId: set.exerciseId,
    round: set.setNumber,
    ...(done === "skipped" ? {
      reps: 0,
      weight: 0,
      skipped: true
    } : done),
    completedAt
  }, tx);
}

// Done: logs the current set, as planned unless the lifter changed the reps or
// weight, and returns the step after it.
export function completeSet(
  sessionId: string,
  payload: CompleteSetPayload = {},
  actor: Actor = "lifter",
  tx?: TransactionType
): SessionStep {
  refuseAiSessionWrite(actor);

  const data = parseOrThrow(completeSetPayloadSchema, payload);

  return inTransaction(tx, t => {
    const { current } = getOpenStep(sessionId, t);

    debug.info("completing set %d of entry %s in session %s", current.setNumber, current.exerciseEntryId, sessionId);

    logSet(sessionId, current, {
      reps: data.reps ?? current.targetReps,
      weight: data.weight ?? current.targetWeight
    }, new Date(), t);

    return getCurrentStep(sessionId, t);
  });
}

// Skips the rest due before the current set and returns the step without it.
// Saved like every tap, so a resumed Session doesn't rest again.
export function skipRest(sessionId: string, actor: Actor = "lifter", tx?: TransactionType): SessionStep {
  refuseAiSessionWrite(actor);

  return inTransaction(tx, t => {
    const { rest } = getOpenStep(sessionId, t);

    if (!rest) {
      throw new ApiError(409, "There's no rest to skip", "ConflictError");
    }

    debug.info("skipping rest in session %s", sessionId);
    // The rest is known by the set it follows, which was done this long before it ends.
    updateSessionDb(sessionId, { restSkippedAfter: new Date(rest.endsAt.getTime() - rest.seconds * 1000) }, t);

    return getCurrentStep(sessionId, t);
  });
}

// Records the current set as skipped and returns the step after it.
export function skipSet(sessionId: string, actor: Actor = "lifter", tx?: TransactionType): SessionStep {
  refuseAiSessionWrite(actor);

  return inTransaction(tx, t => {
    const { current } = getOpenStep(sessionId, t);

    debug.info("skipping set %d of entry %s in session %s", current.setNumber, current.exerciseEntryId, sessionId);
    logSet(sessionId, current, "skipped", new Date(), t);

    return getCurrentStep(sessionId, t);
  });
}

// Records the current set and the rest of its Exercise Entry's sets as skipped,
// and returns the step after them. In a Superset the other entries carry on.
export function skipExercise(sessionId: string, actor: Actor = "lifter", tx?: TransactionType): SessionStep {
  refuseAiSessionWrite(actor);

  return inTransaction(tx, t => {
    const { current } = getOpenStep(sessionId, t);
    const logged = new Set(listLoggedSets(sessionId, t).map(s => setKey(s.exerciseEntryId, s.round)));
    const completedAt = new Date();

    debug.info("skipping entry %s from set %d in session %s", current.exerciseEntryId, current.setNumber, sessionId);

    for (let setNumber = current.setNumber; setNumber <= current.totalSets; setNumber++) {
      if (!logged.has(setKey(current.exerciseEntryId, setNumber))) {
        logSet(sessionId, {
          ...current,
          setNumber
        }, "skipped", completedAt, t);
      }
    }

    return getCurrentStep(sessionId, t);
  });
}

// Flips Increase Next Time for an Exercise Entry of the Session, at any point
// while it's in progress, and returns the step with the toggles as they now are.
export function setIncrease(
  sessionId: string,
  exerciseEntryId: string,
  on: boolean,
  actor: Actor = "lifter",
  tx?: TransactionType
): SessionStep {
  refuseAiSessionWrite(actor);

  const data = parseOrThrow(setIncreasePayloadSchema, {
    exerciseEntryId,
    enabled: on
  });

  return inTransaction(tx, t => {
    const session = getSession(sessionId, t);

    assertInProgress(session);

    if (!session.blocks.flat().some(entry => entry.exerciseEntryId === data.exerciseEntryId)) {
      throw new ApiError(404, `Exercise entry ${data.exerciseEntryId} is not in this Session`, "NotFoundError");
    }

    debug.info("turning Increase Next Time %s for entry %s in session %s", data.enabled ? "on" : "off", data.exerciseEntryId, sessionId);

    const existing = getSessionIncreaseByQuery({
      where: {
        sessionId,
        exerciseEntryId: data.exerciseEntryId
      }
    }, t);

    if (existing) {
      updateSessionIncreaseDb(existing.id, { enabled: data.enabled }, t);
    } else {
      createSessionIncreaseDb({
        sessionId,
        ...data
      }, t);
    }

    return getCurrentStep(sessionId, t);
  });
}

// Raises the target weight of each entry with Increase Next Time on by its
// Weight Step. An entry deleted from the Workout since Start is left alone.
function applyIncreases(sessionId: string, tx: TransactionType): void {
  for (const exerciseEntryId of listIncreases(sessionId, tx)) {
    const entry = getExerciseEntryByQuery({
      where: {
        id: exerciseEntryId,
        deletedAt: { isNull: true }
      }
    }, tx);

    if (entry) {
      raiseTargetWeight(entry.id, tx);
    }
  }
}

// Saves the Session as finished, applies its Increase Next Time toggles and
// moves its Plan's rotation on, together; only an in-progress Session finishes,
// so the increases apply once. A Session finished early records the sets left
// as skipped.
export function finishSession(sessionId: string, actor: Actor = "lifter", tx?: TransactionType): SessionAttributes {
  refuseAiSessionWrite(actor);

  return inTransaction(tx, t => {
    const session = getSession(sessionId, t);
    const finishedAt = new Date();

    assertInProgress(session);
    debug.info("finishing session %s", sessionId);

    for (let { current } = getCurrentStep(sessionId, t); current; { current } = getCurrentStep(sessionId, t)) {
      logSet(sessionId, current, "skipped", finishedAt, t);
    }

    applyIncreases(sessionId, t);
    advanceRotation(session.workoutId, t);

    return updateSessionDb(sessionId, {
      status: "finished",
      finishedAt
    }, t);
  });
}
