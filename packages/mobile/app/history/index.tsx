import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList } from "react-native";

import { listSessionHistory } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { formatDate } from "@/format";

// Past Sessions, newest first, by date and Workout name.
export default function HistoryScreen() {
  const [ sessions, setSessions ] = useState(() => listSessionHistory());

  useFocusEffect(useCallback(() => setSessions(listSessionHistory()), []));

  return (
    <FlatList
      className="flex-1 bg-brand-white"
      data={sessions}
      keyExtractor={s => s.id}
      ListEmptyComponent={(
        <AppText className="p-4 text-brand-mediumGray">Finished workouts show up here.</AppText>
      )}
      renderItem={({ item }) => (
        <AppButton className="border-b border-brand-lighterGray px-4 py-4"
          accessibilityRole="button"
          onPress={() => router.push({
            pathname: "/history/sessions/[id]",
            params: { id: item.id }
          })}>
          <AppText className="text-brand-darkGray">
            {item.workoutName}
            <AppText className="text-brand-mediumGray"> · {formatDate(item.startedAt)}</AppText>
          </AppText>
        </AppButton>
      )}
    />
  );
}
