import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList } from "react-native";

import { listSessionHistory } from "@forklift/core";

import { EmptyState } from "@/components/EmptyState";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { formatDate, formatDuration } from "@/format";

// Past Sessions, newest first, by Workout name, date and how long they took.
export default function HistoryScreen() {
  const [ sessions, setSessions ] = useState(() => listSessionHistory());

  useFocusEffect(useCallback(() => setSessions(listSessionHistory()), []));

  return (
    <Screen>
      <FlatList
        data={sessions}
        keyExtractor={s => s.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-4"
        ListEmptyComponent={(
          <EmptyState icon="time-outline"
            message="Finished workouts show up here." />
        )}
        renderItem={({ item, index }) => (
          <ListRow title={item.workoutName}
            subtitle={`${formatDate(item.startedAt)} · ${formatDuration(item.startedAt, item.finishedAt)}`}
            onPress={() => router.push({
              pathname: "/history/sessions/[id]",
              params: { id: item.id }
            })}
            {...rowPosition(index, sessions.length)} />
        )}
      />
    </Screen>
  );
}
