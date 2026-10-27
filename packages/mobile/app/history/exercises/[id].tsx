import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";

import { getExerciseHistory, getSettings } from "@forklift/core";
import type { ExerciseHistory } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
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
      <Screen className="items-center justify-center p-6">
        <AppText className="text-muted">This exercise has no history.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={history.sessions}
        keyExtractor={s => s.id}
        contentContainerClassName="gap-3 px-4 pb-4"
        ListHeaderComponent={(
          <View className="gap-1 pt-4">
            <AppText weight="semibold"
              className="text-xl text-ink">
              {history.exercise.name}
            </AppText>
            {history.bestSet && (
              <AppText className="text-accent">
                Best set: {formatSet(history.bestSet.reps, history.bestSet.weight, unit)}
              </AppText>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <AppText className="text-muted">No sets done yet.</AppText>
        )}
        renderItem={({ item }) => (
          <Card className="gap-1 px-4 py-3">
            <AppText className="text-ink">
              {formatDate(item.startedAt)}
              <AppText className="text-muted"> · {item.workoutName}</AppText>
            </AppText>
            <AppText className="text-muted">{formatSets(item.sets, unit)}</AppText>
            <AppText className="text-sm text-muted">
              Best: {formatSet(item.bestSet.reps, item.bestSet.weight, unit)}
            </AppText>
          </Card>
        )}
    />
    </Screen>
  );
}
