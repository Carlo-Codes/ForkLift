import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";

import { getExerciseHistory, getSettings } from "@forklift/core";
import type { ExerciseHistory } from "@forklift/core";

import { AppText } from "@/components/AppText";
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
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This exercise has no history.</AppText>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-brand-white"
      data={history.sessions}
      keyExtractor={s => s.id}
      ListHeaderComponent={(
        <View className="gap-1 border-b border-brand-lighterGray p-4">
          <AppText weight="semibold"
            className="text-xl text-brand-darkGray">
            {history.exercise.name}
          </AppText>
          {history.bestSet && (
            <AppText className="text-brand-primary">
              Best set: {formatSet(history.bestSet.reps, history.bestSet.weight, unit)}
            </AppText>
          )}
        </View>
      )}
      ListEmptyComponent={(
        <AppText className="p-4 text-brand-mediumGray">No sets done yet.</AppText>
      )}
      renderItem={({ item }) => (
        <View className="gap-1 border-b border-brand-lighterGray px-4 py-3">
          <AppText className="text-brand-darkGray">
            {formatDate(item.startedAt)}
            <AppText className="text-brand-mediumGray"> · {item.workoutName}</AppText>
          </AppText>
          <AppText className="text-brand-mediumGray">{formatSets(item.sets, unit)}</AppText>
          <AppText className="text-sm text-brand-mediumGray">
            Best: {formatSet(item.bestSet.reps, item.bestSet.weight, unit)}
          </AppText>
        </View>
      )}
    />
  );
}
