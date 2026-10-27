import {
  Link, router, useFocusEffect
} from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import { searchExercises } from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";

export default function ExerciseLibraryScreen() {
  const [ query, setQuery ] = useState("");
  const [ exercises, setExercises ] = useState<ExerciseAttributes[]>([]);

  // Re-read on focus so adds, edits and deletes show when coming back.
  useFocusEffect(useCallback(() => {
    setExercises(searchExercises(query));
  }, [ query ]));

  return (
    <Screen>
      <View className="gap-3 p-4">
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
        <Link href="/exercises/new"
          asChild>
          <AppButton variant="secondary"
            className="self-start">
            Add exercise
          </AppButton>
        </Link>
      </View>
      <FlatList
        data={exercises}
        keyExtractor={e => e.id}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <AppText className="text-muted">
            {query.trim() ? `No exercises match "${query.trim()}".` : "No exercises yet."}
          </AppText>
        )}
        renderItem={({ item, index }) => (
          <ListRow title={item.name}
            subtitle={[ item.muscleGroups.join(", "), item.equipment ].filter(Boolean).join(" · ") || undefined}
            onPress={() => router.push({
              pathname: "/exercises/[id]",
              params: { id: item.id }
            })}
            {...rowPosition(index, exercises.length)} />
        )}
      />
    </Screen>
  );
}
