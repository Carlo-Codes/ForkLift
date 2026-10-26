import {
  Link, router, useLocalSearchParams
} from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import {
  deleteExercise, getExercise, updateExercise
} from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { ExerciseForm } from "@/components/ExerciseForm";

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
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This exercise no longer exists.</AppText>
      </View>
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
        <AppButton className="items-center p-4">
          <AppText className="text-brand-primary">History</AppText>
        </AppButton>
      </Link>
      <AppButton className="items-center p-4"
        onPress={confirmDelete}>
        <AppText className="text-brand-error">Delete exercise</AppText>
      </AppButton>
    </ExerciseForm>
  );
}
