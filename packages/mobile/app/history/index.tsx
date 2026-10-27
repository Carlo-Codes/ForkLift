import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList } from "react-native";

import { listSessionHistory } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { formatDate } from "@/format";

// Past Sessions, newest first, by date and Workout name.
export default function HistoryScreen() {
  const [ sessions, setSessions ] = useState(() => listSessionHistory());

  useFocusEffect(useCallback(() => setSessions(listSessionHistory()), []));

  return (
    <Screen>
      <FlatList
        data={sessions}
        keyExtractor={s => s.id}
        contentContainerClassName="p-4"
        ListEmptyComponent={(
          <AppText className="text-muted">Finished workouts show up here.</AppText>
        )}
        renderItem={({ item, index }) => (
          <ListRow title={item.workoutName}
            subtitle={formatDate(item.startedAt)}
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
