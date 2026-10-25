import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { createBlock, searchExercises } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";

// Picks an Exercise from the library and adds it to the Workout as a new Block
// with default targets, then opens those targets for editing.
export default function AddExerciseToWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [ query, setQuery ] = useState("");
  const [ error, setError ] = useState<string>();
  const exercises = useMemo(() => searchExercises(query), [ query ]);

  const pick = (exerciseId: string) => {
    try {
      const entry = createBlock(workoutId, { exerciseId }).exerciseEntries[ 0 ]!;

      router.replace({
        pathname: "/entries/[id]",
        params: { id: entry.id }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="flex-1 bg-brand-white">
      <View className="gap-2 p-4">
        <AppTextInput
          className="rounded-lg border border-brand-lightGray px-3 py-2 text-brand-darkGray"
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
        {error && <AppText className="text-brand-error">{error}</AppText>}
      </View>
      <FlatList
        data={exercises}
        keyExtractor={e => e.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <AppText className="px-4 text-brand-mediumGray">
            {query.trim() ? `No exercises match "${query.trim()}".` : "The Exercise Library is empty."}
          </AppText>
        )}
        renderItem={({ item }) => (
          <AppButton className="border-b border-brand-lighterGray px-4 py-3"
            onPress={() => pick(item.id)}>
            <AppText className="text-brand-darkGray">{item.name}</AppText>
            {item.muscleGroups.length > 0 && (
              <AppText className="text-sm text-brand-mediumGray">{item.muscleGroups.join(", ")}</AppText>
            )}
          </AppButton>
        )}
      />
    </View>
  );
}
