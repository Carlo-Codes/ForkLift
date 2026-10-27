import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import {
  createBlock, createExerciseEntry, searchExercises
} from "@forklift/core";

import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";

// Picks an Exercise from the library and adds it to the Workout as a new Block
// with default targets, or to the Superset blockId names, then opens those
// targets for editing.
export default function AddExerciseToWorkoutScreen() {
  const { workoutId, blockId } = useLocalSearchParams<{ workoutId: string; blockId?: string }>();
  const [ query, setQuery ] = useState("");
  const [ error, setError ] = useState<string>();
  const exercises = useMemo(() => searchExercises(query), [ query ]);

  const pick = (exerciseId: string) => {
    try {
      const entry = blockId ?
        createExerciseEntry(blockId, { exerciseId }) :
        createBlock(workoutId, { exerciseId }).exerciseEntries[ 0 ]!;

      router.replace({
        pathname: "/entries/[id]",
        params: { id: entry.id }
      });
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
