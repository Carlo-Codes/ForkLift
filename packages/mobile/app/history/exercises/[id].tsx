import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";

import { getExerciseHistory, getSettings } from "@forklift/core";
import type { ExerciseHistory } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { rowSurfaceClass, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import {
  formatDate, formatSet, formatSets
} from "@/format";

function loadHistory(id: string): ExerciseHistory | undefined {
  try {
    return getExerciseHistory(id);
  } catch {
    return undefined;
  }
}

// One Exercise across past Sessions: date, weight × reps and the best sets.
export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ history ] = useState(() => loadHistory(id));
  const [ unit ] = useState(() => getSettings().unit);

  if (!history) {
    return (
      <Screen className="justify-center">
        <EmptyState icon="alert-circle-outline"
          message="This exercise has no history." />
      </Screen>
    );
  }

  const { bestSet, sessions } = history;

  return (
    <Screen>
      <Stack.Screen options={{ title: history.exercise.name }} />
      <FlatList
        data={sessions}
        keyExtractor={s => s.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-4"
        ListHeaderComponent={bestSet && (
          <Card className="mb-4 gap-1 p-5">
            <AppText className="text-sm text-muted">Best set</AppText>
            <AppText weight="semibold"
              className="text-3xl text-accent">
              {formatSet(bestSet.reps, bestSet.weight, unit)}
            </AppText>
          </Card>
        )}
        ListEmptyComponent={(
          <EmptyState icon="barbell-outline"
            message="No sets done yet." />
        )}
        renderItem={({ item, index }) => (
          <View className={`gap-1 px-4 py-3 ${rowSurfaceClass(rowPosition(index, sessions.length))}`}>
            <View className="flex-row items-baseline justify-between gap-2">
              <AppText weight="semibold"
                className="text-ink">
                {formatDate(item.startedAt)}
              </AppText>
              <AppText numberOfLines={1}
                className="shrink text-sm text-muted">
                {item.workoutName}
              </AppText>
            </View>
            <AppText className="text-ink">{formatSets(item.sets, unit)}</AppText>
            <AppText className="text-sm text-muted">
              Best: {formatSet(item.bestSet.reps, item.bestSet.weight, unit)}
            </AppText>
          </View>
        )}
      />
    </Screen>
  );
}
