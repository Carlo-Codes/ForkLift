import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { searchExercises } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { addToWorkout } from "@/addToWorkout";

// The Plan editor's Add exercise: a searchable pick from the Exercise Library,
// added to the Workout as a new Block with the default targets, or to the
// Superset blockId names, then back to the editor. New exercise at the top
// adds one to the library and the Workout in one go.
export default function AddExerciseToWorkoutScreen() {
  const { workoutId, blockId } = useLocalSearchParams<{ workoutId: string; blockId?: string }>();
  const [ query, setQuery ] = useState("");
  const [ error, setError ] = useState<string>();
  const exercises = useMemo(() => searchExercises(query), [ query ]);

  const pick = (exerciseId: string) => {
    try {
      addToWorkout({
        workoutId,
        blockId
      }, exerciseId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <View className="gap-2 p-4">
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
        {error && <AppText className="text-danger">{error}</AppText>}
      </View>
      <FlatList
        data={exercises}
        keyExtractor={e => e.id}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <AppButton className="mb-3 min-h-touch flex-row items-center gap-2 rounded-2xl bg-surface px-4"
            onPress={() => router.push({
              pathname: "/exercises/new",
              params: {
                workoutId,
                ...(blockId && { blockId })
              }
            })}>
            <AppIcon name="add-circle"
              color="accent"
              size={22} />
            <AppText weight="semibold"
              className="text-accent">
              New exercise
            </AppText>
          </AppButton>
        )}
        ListEmptyComponent={(
          <AppText className="text-muted">
            {query.trim() ? `No exercises match "${query.trim()}".` : "The Exercise Library is empty."}
          </AppText>
        )}
        renderItem={({ item, index }) => (
          <ListRow title={item.name}
            subtitle={item.muscleGroups.join(", ") || undefined}
            onPress={() => pick(item.id)}
            {...rowPosition(index, exercises.length)} />
        )}
      />
    </Screen>
  );
}
