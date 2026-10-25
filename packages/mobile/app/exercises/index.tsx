import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import { searchExercises } from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";

export default function ExerciseLibraryScreen() {
  const [ query, setQuery ] = useState("");
  const [ exercises, setExercises ] = useState<ExerciseAttributes[]>([]);

  // Re-read on focus so adds, edits and deletes show when coming back.
  useFocusEffect(useCallback(() => {
    setExercises(searchExercises(query));
  }, [ query ]));

  return (
    <View className="flex-1 bg-brand-white">
      <View className="gap-3 p-4">
        <AppTextInput
          className="rounded-lg border border-brand-lightGray px-3 py-2 text-brand-darkGray"
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
        <Link href="/exercises/new"
          asChild>
          <AppButton variant="outline"
            className="self-start">
            Add exercise
          </AppButton>
        </Link>
      </View>
      <FlatList
        data={exercises}
        keyExtractor={e => e.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <AppText className="px-4 text-brand-mediumGray">
            {query.trim() ? `No exercises match "${query.trim()}".` : "No exercises yet."}
          </AppText>
        )}
        renderItem={({ item }) => (
          <Link href={{
            pathname: "/exercises/[id]",
            params: { id: item.id }
          }}
            asChild>
            <AppButton className="border-b border-brand-lighterGray px-4 py-3">
              <AppText className="text-brand-darkGray">{item.name}</AppText>
              {(item.muscleGroups.length > 0 || item.equipment) && (
                <AppText className="text-sm text-brand-mediumGray">
                  {[ item.muscleGroups.join(", "), item.equipment ].filter(Boolean).join(" · ")}
                </AppText>
              )}
            </AppButton>
          </Link>
        )}
      />
    </View>
  );
}
