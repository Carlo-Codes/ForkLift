import type {
  ExerciseAttributes, LoggedSetAttributes, SessionAttributes, SessionEntrySnapshot, TransactionType
} from "@forklift/db/client";
import { ApiError } from "@forklift/debug";

import { getExerciseByQuery } from "../../exercise/src/exerciseDb";
import { getWorkoutByQuery } from "../../plan/workout/src/workoutDb";
import { getAllLoggedSetByQuery } from "../../session/loggedSet/src/loggedSetDb";
import { listLoggedSets } from "../../session/loggedSet/src/loggedSetService";
import { getAllSessionByQuery, getSessionByQuery } from "../../session/src/sessionDb";

// History is read-only and outlives the Plans, Workouts and Exercises it used,
// so it reads them whether or not they're deleted since.

// A past Session as the History list shows it.
export interface SessionSummary {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: Date;
  finishedAt: Date;
}

// A Logged Set as history shows it: reps and weight actually done, or skipped.
export type HistorySet = Pick<LoggedSetAttributes, "round" | "reps" | "weight" | "skipped" | "completedAt">;

// An Exercise Entry of a past Session, named as it was at Start, with its sets in order.
export interface SessionDetailEntry {
  exerciseEntryId: string;
  exerciseId: string;
  exerciseName: string;
  sets: HistorySet[];
}

export interface SessionDetail extends SessionSummary {
  blocks: SessionDetailEntry[][];
}

// One past Session's sets of an Exercise, done ones only, and the best of them.
export interface ExerciseHistorySession extends SessionSummary {
  sets: HistorySet[];
  bestSet: HistorySet;
}

export interface ExerciseHistory {
  exercise: ExerciseAttributes;
  sessions: ExerciseHistorySession[];
  bestSet?: HistorySet;
}

// What an Exercise Entry's sets were in the last finished Session that did any.
export interface LastTime {
  sessionId: string;
  startedAt: Date;
  sets: HistorySet[];
}

function toHistorySet({
  round, reps, weight, skipped, completedAt
}: LoggedSetAttributes): HistorySet {
  return {
    round,
    reps,
    weight,
    skipped,
    completedAt
  };
}

function toSummary(session: SessionAttributes, tx?: TransactionType): SessionSummary {
  const workout = getWorkoutByQuery({ where: { id: session.workoutId } }, tx);

  return {
    id: session.id,
    workoutId: session.workoutId,
    workoutName: workout?.name ?? "",
    startedAt: session.startedAt,
    finishedAt: session.finishedAt ?? session.startedAt
  };
}

// Finished Sessions, newest first.
export function listSessionHistory(tx?: TransactionType): SessionSummary[] {
  return getAllSessionByQuery({
    where: {
      status: "finished",
      deletedAt: { isNull: true }
    }
  }, tx).map(session => toSummary(session, tx));
}

// Every Logged Set of the Session, by its Blocks and Exercise Entries as at Start.
export function getSessionDetail(sessionId: string, tx?: TransactionType): SessionDetail {
  const session = getSessionByQuery({
    where: {
      id: sessionId,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!session) {
    throw new ApiError(404, `Session ${sessionId} not found`, "NotFoundError");
  }

  const loggedSets = listLoggedSets(sessionId, tx);

  const toEntry = (entry: SessionEntrySnapshot): SessionDetailEntry => ({
    exerciseEntryId: entry.exerciseEntryId,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    sets: loggedSets.filter(s => s.exerciseEntryId === entry.exerciseEntryId)
      .sort((a, b) => a.round - b.round)
      .map(toHistorySet)
  });

  return {
    ...toSummary(session, tx),
    blocks: session.blocks.map(entries => entries.map(toEntry))
  };
}

// The best set is the heaviest; more reps break a tie, so bodyweight sets
// (weight 0) rank by reps.
function bestOf<T extends HistorySet>(sets: T[]): T | undefined {
  return sets.reduce<T | undefined>((best, set) => (!best || set.weight > best.weight ||
    (set.weight === best.weight && set.reps > best.reps) ? set : best), undefined);
}

// The finished Sessions, newest first, with the sets done in each that match
// the filter, in the order they were done; Sessions with none are left out.
function doneSetsByFinishedSession(
  where: { exerciseId: string; exerciseEntryId?: string },
  tx?: TransactionType
): { session: SessionAttributes; sets: HistorySet[] }[] {
  const loggedSets = getAllLoggedSetByQuery({
    where: {
      ...where,
      skipped: false,
      deletedAt: { isNull: true }
    }
  }, tx);

  return getAllSessionByQuery({
    where: {
      id: { in: [ ...new Set(loggedSets.map(s => s.sessionId)) ] },
      status: "finished",
      deletedAt: { isNull: true }
    }
  }, tx).map(session => ({
    session,
    sets: loggedSets.filter(s => s.sessionId === session.id).map(toHistorySet)
  }));
}

// Each finished Session that did the Exercise, newest first, with the sets done
// and the best of them, and the best set overall.
export function getExerciseHistory(exerciseId: string, tx?: TransactionType): ExerciseHistory {
  const exercise = getExerciseByQuery({ where: { id: exerciseId } }, tx);

  if (!exercise) {
    throw new ApiError(404, `Exercise ${exerciseId} not found`, "NotFoundError");
  }

  const sessions = doneSetsByFinishedSession({ exerciseId }, tx).map(({ session, sets }) => ({
    ...toSummary(session, tx),
    sets,
    bestSet: bestOf(sets)!
  }));

  return {
    exercise,
    sessions,
    bestSet: bestOf(sessions.map(s => s.bestSet))
  };
}

// "Last time" for Workout Mode: the sets done for the Exercise Entry in its most
// recent finished Session, passing over Sessions where it was all skipped. Only
// sets of the entry's current Exercise count, so switching the Exercise starts
// afresh.
export function getLastTime(
  entry: { exerciseEntryId: string; exerciseId: string },
  tx?: TransactionType
): LastTime | undefined {
  const [ last ] = doneSetsByFinishedSession({
    exerciseEntryId: entry.exerciseEntryId,
    exerciseId: entry.exerciseId
  }, tx);

  return last && {
    sessionId: last.session.id,
    startedAt: last.session.startedAt,
    sets: last.sets
  };
}
