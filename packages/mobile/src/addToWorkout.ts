import { createBlock, createExerciseEntry } from "@forklift/core";

// Where the Plan editor's exercise picker adds to: a new Block at the end of
// the Workout, or the Superset blockId names.
export interface AddTarget {
  workoutId: string;
  blockId?: string;
}

// Adds the Exercise with the default targets.
export function addToWorkout({ workoutId, blockId }: AddTarget, exerciseId: string): void {
  if (blockId) {
    createExerciseEntry(blockId, { exerciseId });
  } else {
    createBlock(workoutId, { exerciseId });
  }
}
