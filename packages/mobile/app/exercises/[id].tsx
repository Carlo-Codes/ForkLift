import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import {
  deleteExercise, getExercise, updateExercise
} from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { ExerciseForm } from "@/components/ExerciseForm";
import { ListRow } from "@/components/ListRow";
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
      <Screen className="justify-center">
        <EmptyState icon="alert-circle-outline"
          message="This exercise no longer exists." />
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
      <ListRow title="History"
        subtitle="Every session that did this exercise"
        onPress={() => router.push({
          pathname: "/history/exercises/[id]",
          params: { id: exercise.id }
        })}
        first
        last />
      <AppButton variant="destructive"
        onPress={confirmDelete}>
        Delete exercise
      </AppButton>
    </ExerciseForm>
  );
}
