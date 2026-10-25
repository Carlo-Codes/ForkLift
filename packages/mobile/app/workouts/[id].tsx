import {
  Link, router, useFocusEffect, useLocalSearchParams
} from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert, FlatList, View
} from "react-native";

import {
  deleteWorkout,
  getSettings,
  getWorkout,
  listBlocks,
  reorderBlocks,
  updateWorkout
} from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import type { WorkoutAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { NameInput } from "@/components/NameInput";
import { moveId, OrderedRow } from "@/components/OrderedRow";
import { formatTargets } from "@/format";

interface WorkoutState {
  workout: WorkoutAttributes;
  blocks: BlockWithEntries[];
}

function loadWorkout(id: string): WorkoutState | undefined {
  try {
    return {
      workout: getWorkout(id),
      blocks: listBlocks(id)
    };
  } catch {
    return undefined;
  }
}

export default function WorkoutEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ state, setState ] = useState(() => loadWorkout(id));
  const [ unit ] = useState(() => getSettings().unit);
  const refresh = useCallback(() => setState(loadWorkout(id)), [ id ]);

  useFocusEffect(refresh);

  if (!state) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This workout no longer exists.</AppText>
      </View>
    );
  }

  const { workout, blocks } = state;

  const move = (index: number, delta: -1 | 1) => {
    reorderBlocks(workout.id, moveId(blocks.map(b => b.id), index, delta));
    refresh();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${workout.name}?`,
      "Its exercises are removed from the plan. Past Sessions are kept.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteWorkout(workout.id);
            router.back();
          }
        }
      ]
    );
  };

  return (
    <FlatList
      className="flex-1 bg-brand-white"
      data={blocks}
      keyExtractor={b => b.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View className="gap-4 p-4">
          <NameInput
            key={workout.id}
            initial={workout.name}
            placeholder="Workout name"
            submitLabel="Rename"
            onSubmit={name => {
              updateWorkout(workout.id, { name });
              refresh();
            }}
          />
          <Link href={{
            pathname: "/workouts/add-exercise",
            params: { workoutId: workout.id }
          }}
            asChild>
            <AppButton variant="outline"
              className="self-start">
              Add exercise
            </AppButton>
          </Link>
        </View>
      )}
      ListEmptyComponent={(
        <AppText className="px-4 text-brand-mediumGray">
          No exercises yet. Add one from the Exercise Library.
        </AppText>
      )}
      renderItem={({ item, index }) => {
        // Blocks hold a single Exercise Entry until Supersets arrive.
        const entry = item.exerciseEntries[ 0 ];

        if (!entry) {
          return null;
        }

        return (
          <OrderedRow
            title={entry.exercise.name}
            subtitle={formatTargets(entry, unit)}
            onPress={() => router.push({
              pathname: "/entries/[id]",
              params: { id: entry.id }
            })}
            onMoveUp={index > 0 ? () => move(index, -1) : undefined}
            onMoveDown={index < blocks.length - 1 ? () => move(index, 1) : undefined}
          />
        );
      }}
      ListFooterComponent={(
        <AppButton className="items-center p-4"
          onPress={confirmDelete}>
          <AppText className="text-brand-error">Delete workout</AppText>
        </AppButton>
      )}
    />
  );
}
