import {
  Link, router, useLocalSearchParams
} from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import {
  deleteExercise, getExercise, updateExercise
} from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { ExerciseForm } from "@/components/ExerciseForm";
import { Screen } from "@/components/Screen";

function loadExercise(id: string): ExerciseAttributes | undefined {
  try {
    return getExercise(id);
  } catch {
    return undefined;
  }
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ exercise ] = useState(() => loadExercise(id));

  if (!exercise) {
    return (
      <Screen className="items-center justify-center p-6">
        <AppText className="text-muted">This exercise no longer exists.</AppText>
      </Screen>
    );
  }

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${exercise.name}?`,
      "It disappears from the Exercise Library. Past Sessions that used it are kept.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteExercise(exercise.id);
            router.back();
          }
        }
      ]
    );
  };

  return (
    <ExerciseForm
      initial={exercise}
      submitLabel="Save"
      onSubmit={payload => {
        updateExercise(exercise.id, payload);
        router.back();
      }}
    >
      <Link href={{
        pathname: "/history/exercises/[id]",
        params: { id: exercise.id }
      }}
        asChild>
        <AppButton variant="link">History</AppButton>
      </Link>
      <AppButton variant="destructive"
        onPress={confirmDelete}>
        Delete exercise
      </AppButton>
    </ExerciseForm>
  );
}
