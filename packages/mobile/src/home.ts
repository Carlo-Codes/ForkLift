import {
  getActivePlan,
  getNextWorkout,
  getPlanByQuery,
  getWorkoutByQuery,
  listBlocks,
  resumeSession
} from "@forklift/core";

import { formatEntrySummary } from "./format";

// What the one card on Home offers: to Resume the Session in progress, to Start
// the Active Plan's next Workout, or what's missing before either can happen.
export type HomeCard =
  | { kind: "resume"; sessionId: string; workoutName: string; planName?: string; entries: string }
  | { kind: "next"; workoutId: string; workoutName: string; planName: string; entries: string }
  | { kind: "emptyPlan"; planId: string; planName: string }
  | { kind: "noPlan" };

export function loadHomeCard(): HomeCard {
  const inProgress = resumeSession()?.session;

  if (inProgress) {
    // The Workout may have been deleted since Start, so it's read regardless,
    // and the entries come from the Session's own snapshot.
    const workout = getWorkoutByQuery({ where: { id: inProgress.workoutId } });
    const plan = workout && getPlanByQuery({ where: { id: workout.planId } });

    return {
      kind: "resume",
      sessionId: inProgress.id,
      workoutName: workout?.name ?? "Workout",
      planName: plan?.name,
      entries: formatEntrySummary(inProgress.blocks.flat())
    };
  }

  const plan = getActivePlan();

  if (!plan) {
    return { kind: "noPlan" };
  }

  const next = getNextWorkout();

  if (!next) {
    return {
      kind: "emptyPlan",
      planId: plan.id,
      planName: plan.name
    };
  }

  const entries = listBlocks(next.id).flatMap(block => block.exerciseEntries.map(entry => ({
    exerciseName: entry.exercise.name,
    targetSets: entry.targetSets,
    targetReps: entry.targetReps
  })));

  return {
    kind: "next",
    workoutId: next.id,
    workoutName: next.name,
    planName: plan.name,
    entries: formatEntrySummary(entries)
  };
}
