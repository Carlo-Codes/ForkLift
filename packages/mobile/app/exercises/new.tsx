import { router, useLocalSearchParams } from "expo-router";

import { createExercise } from "@forklift/core";

import { addToWorkout } from "@/addToWorkout";
import { ExerciseForm } from "@/components/ExerciseForm";

// Adds an Exercise to the library. Opened from the Plan editor's exercise
// picker (workoutId set), it's also added to that Workout and both screens
// close, back to the editor.
export default function AddExerciseScreen() {
  const { workoutId, blockId } = useLocalSearchParams<{ workoutId?: string; blockId?: string }>();

  return (
    <ExerciseForm
      submitLabel="Add exercise"
      onSubmit={payload => {
        const exercise = createExercise(payload);

        if (workoutId) {
          addToWorkout({
            workoutId,
            blockId
          }, exercise.id);
          router.dismiss(2);
        } else {
          router.back();
        }
      }}
    />
  );
}
