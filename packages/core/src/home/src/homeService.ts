import type { SessionEntrySnapshot, TransactionType } from "@forklift/db/client";

import { getActivePlan, getNextWorkout } from "#plan/planService";
import { getPlanByQuery } from "#plan/planDb";
import { resumeSession, snapshotWorkout } from "#session/sessionService";
import { getWorkoutByQuery } from "#workout/workoutDb";

// An Exercise Entry as Home lists it, e.g. "Bench Press 3×8".
export type HomeEntry = Pick<SessionEntrySnapshot, "exerciseName" | "targetSets" | "targetReps">;

// What the one card on Home offers: to Resume the Session in progress, to Start
// the Active Plan's next Workout, or what's missing before either can happen.
export type HomeCard =
  | { kind: "resume"; sessionId: string; workoutName: string; planName?: string; entries: HomeEntry[] }
  | { kind: "next"; workoutId: string; workoutName: string; planName: string; entries: HomeEntry[] }
  | { kind: "emptyPlan"; planId: string; planName: string }
  | { kind: "noPlan" };

const toHomeEntries = (blocks: SessionEntrySnapshot[][]): HomeEntry[] => blocks.flat().map(entry => ({
  exerciseName: entry.exerciseName,
  targetSets: entry.targetSets,
  targetReps: entry.targetReps
}));

export function getHomeCard(tx?: TransactionType): HomeCard {
  const inProgress = resumeSession(tx)?.session;

  if (inProgress) {
    // The entries come from the Session's snapshot, and its Workout is read
    // even if deleted since Start; one missing is named "", as history names it.
    const workout = getWorkoutByQuery({ where: { id: inProgress.workoutId } }, tx);
    const plan = workout && getPlanByQuery({ where: { id: workout.planId } }, tx);

    return {
      kind: "resume",
      sessionId: inProgress.id,
      workoutName: workout?.name ?? "",
      planName: plan?.name,
      entries: toHomeEntries(inProgress.blocks)
    };
  }

  const plan = getActivePlan(tx);

  if (!plan) {
    return { kind: "noPlan" };
  }

  const next = getNextWorkout(tx);

  if (!next) {
    return {
      kind: "emptyPlan",
      planId: plan.id,
      planName: plan.name
    };
  }

  return {
    kind: "next",
    workoutId: next.id,
    workoutName: next.name,
    planName: plan.name,
    entries: toHomeEntries(snapshotWorkout(next.id, tx))
  };
}
