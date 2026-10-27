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
  groupBlocks,
  listBlocks,
  reorderBlocks,
  reorderExerciseEntries,
  ungroupBlock,
  updateWorkout
} from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import type { Unit, WorkoutAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { NameInput } from "@/components/NameInput";
import { moveId, OrderedRow } from "@/components/OrderedRow";
import { Screen } from "@/components/Screen";
import { SupersetGroup } from "@/components/SupersetGroup";
import { formatTargets } from "@/format";

interface WorkoutState {
  workout: WorkoutAttributes;
  blocks: BlockWithEntries[];
  unit: Unit;
}

function loadWorkout(id: string): WorkoutState | undefined {
  try {
    return {
      workout: getWorkout(id),
      blocks: listBlocks(id),
      // Re-read with the blocks: a unit switch converts their weights.
      unit: getSettings().unit
    };
  } catch {
    return undefined;
  }
}

export default function WorkoutEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ state, setState ] = useState(() => loadWorkout(id));
  const refresh = useCallback(() => setState(loadWorkout(id)), [ id ]);

  useFocusEffect(refresh);

  if (!state) {
    return (
      <Screen className="items-center justify-center p-6">
        <AppText className="text-muted">This workout no longer exists.</AppText>
      </Screen>
    );
  }

  const {
    workout, blocks, unit
  } = state;

  const move = (index: number, delta: -1 | 1) => {
    reorderBlocks(workout.id, moveId(blocks.map(b => b.id), index, delta));
    refresh();
  };

  const moveEntry = (block: BlockWithEntries, index: number, delta: -1 | 1) => {
    reorderExerciseEntries(block.id, moveId(block.exerciseEntries.map(e => e.id), index, delta));
    refresh();
  };

  const openEntry = (entryId: string) => router.push({
    pathname: "/entries/[id]",
    params: { id: entryId }
  });

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
    <Screen>
      <FlatList
        data={blocks}
        keyExtractor={b => b.id}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View className="gap-4 py-4">
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
              <AppButton variant="secondary"
                className="self-start">
                Add exercise
              </AppButton>
            </Link>
          </View>
        )}
        ListEmptyComponent={(
          <AppText className="text-muted">
            No exercises yet. Add one from the Exercise Library.
          </AppText>
        )}
        renderItem={({ item, index }) => {
          const [ entry, ...others ] = item.exerciseEntries;
          const next = blocks[ index + 1 ];
          const onMoveUp = index > 0 ? () => move(index, -1) : undefined;
          const onMoveDown = next ? () => move(index, 1) : undefined;

          if (!entry) {
            return null;
          }

          return (
            <View>
              {others.length > 0 ?
                (
                  <SupersetGroup
                    block={item}
                    unit={unit}
                    onPressEntry={e => openEntry(e.id)}
                    onMoveEntry={(entryIndex, delta) => moveEntry(item, entryIndex, delta)}
                    onAddEntry={() => router.push({
                      pathname: "/workouts/add-exercise",
                      params: {
                        workoutId: workout.id,
                        blockId: item.id
                      }
                    })}
                    onUngroup={() => {
                      ungroupBlock(item.id);
                      refresh();
                    }}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                />
                ) :
                (
                  <OrderedRow
                    title={entry.exercise.name}
                    subtitle={formatTargets(entry, unit)}
                    onPress={() => openEntry(entry.id)}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    first
                    last
                />
                )}
              {next && (
                <AppButton className="min-h-touch flex-row items-center justify-center gap-1"
                  accessibilityLabel="Superset with the next exercise"
                  onPress={() => {
                    groupBlocks(workout.id, [ item.id, next.id ]);
                    refresh();
                  }}>
                  <AppIcon name="link"
                    color="accent"
                    size={16} />
                  <AppText className="text-sm text-accent">Superset with next</AppText>
                </AppButton>
              )}
            </View>
          );
        }}
        ListFooterComponent={(
          <AppButton variant="destructive"
            className="mt-4"
            onPress={confirmDelete}>
            Delete workout
          </AppButton>
        )}
    />
    </Screen>
  );
}
