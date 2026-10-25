import { router } from "expo-router";

import { createExercise } from "@forklift/core";

import { ExerciseForm } from "@/components/ExerciseForm";

export default function AddExerciseScreen() {
  return (
    <ExerciseForm
      submitLabel="Add exercise"
      onSubmit={payload => {
        createExercise(payload);
        router.back();
      }}
    />
  );
}
