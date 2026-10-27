import { router, useLocalSearchParams } from "expo-router";

import { createExercise, createExerciseInWorkout } from "@forklift/core";

import { ExerciseForm } from "@/components/ExerciseForm";

// Adds an Exercise to the library. Opened from the Plan editor's exercise
// picker (workoutId set), it's added to that Workout too, in the same write,
// and both screens close, back to the editor.
export default function AddExerciseScreen() {
  const { workoutId, blockId } = useLocalSearchParams<{ workoutId?: string; blockId?: string }>();

  return (
    <ExerciseForm
      submitLabel="Add exercise"
      onSubmit={payload => {
        if (workoutId) {
          createExerciseInWorkout({
            workoutId,
            blockId
          }, payload);
          router.dismiss(2);
        } else {
          createExercise(payload);
          router.back();
        }
      }}
    />
  );
}
