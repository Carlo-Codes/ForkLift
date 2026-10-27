import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { addExerciseToWorkout, searchExercises } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { errorMessage } from "@/errorMessage";

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
      addExerciseToWorkout({
        workoutId,
        blockId
      }, exerciseId);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
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
          <View className="mb-3">
            <ListRow title="New exercise"
              subtitle="Add one to the Exercise Library and this workout"
              onPress={() => router.push({
                pathname: "/exercises/new",
                params: {
                  workoutId,
                  ...(blockId && { blockId })
                }
              })}
              first
              last />
          </View>
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
