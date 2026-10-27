import {
  Link, router, useFocusEffect
} from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import { searchExercises } from "@forklift/core";
import type { ExerciseAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { EmptyState } from "@/components/EmptyState";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";

// The Exercise Library: search by name, add an Exercise, or open one to edit.
export default function ExerciseLibraryScreen() {
  const [ query, setQuery ] = useState("");
  const [ exercises, setExercises ] = useState<ExerciseAttributes[]>([]);

  // Re-read on focus so adds, edits and deletes show when coming back.
  useFocusEffect(useCallback(() => {
    setExercises(searchExercises(query));
  }, [ query ]));

  return (
    <Screen>
      {/* One scroll view, first in the screen, so the large title collapses
          as the list scrolls; the search field scrolls with it. */}
      <FlatList
        data={exercises}
        keyExtractor={e => e.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={(
          <View className="flex-row items-center gap-2 py-4">
            <AppTextInput
              className="flex-1"
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
                accessibilityLabel="Add exercise">
                <AppIcon name="add"
                  color="accent" />
                <AppText weight="semibold"
                  className="text-accent">
                  Add
                </AppText>
              </AppButton>
            </Link>
          </View>
        )}
        ListEmptyComponent={(
          <EmptyState icon="barbell-outline"
            message={query.trim() ? `No exercises match "${query.trim()}".` : "No exercises yet."} />
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
