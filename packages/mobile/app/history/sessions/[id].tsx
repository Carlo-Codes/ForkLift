import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { getSessionDetail, getSettings } from "@forklift/core";
import type { SessionDetail } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { formatDate, formatSet } from "@/format";

function loadDetail(id: string): SessionDetail | undefined {
  try {
    return getSessionDetail(id);
  } catch {
    return undefined;
  }
}

// One past Session: every Logged Set, by Block and Exercise Entry.
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ detail ] = useState(() => loadDetail(id));
  const [ unit ] = useState(() => getSettings().unit);

  if (!detail) {
    return (
      <Screen className="items-center justify-center p-6">
        <AppText className="text-muted">This session no longer exists.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <AppText weight="semibold"
          className="text-xl text-ink">
          {detail.workoutName} · {formatDate(detail.startedAt)}
        </AppText>
        {detail.blocks.map((entries, b) => (
          <Card key={b}
            className="gap-3 p-4">
            {entries.length > 1 && <AppText className="text-sm text-accent">Superset</AppText>}
            {entries.map(entry => (
              <View key={entry.exerciseEntryId}
                className="gap-1">
                <AppButton accessibilityRole="link"
                  accessibilityHint="Show this exercise's history"
                  onPress={() => router.push({
                    pathname: "/history/exercises/[id]",
                    params: { id: entry.exerciseId }
                  })}>
                  <AppText weight="semibold"
                    className="text-ink">
                    {entry.exerciseName}
                  </AppText>
                </AppButton>
                {entry.sets.map(set => (
                  <AppText key={set.round}
                    className={set.skipped ? "text-faint" : "text-muted"}>
                    Set {set.round}: {set.skipped ? "skipped" : formatSet(set.reps, set.weight, unit)}
                  </AppText>
                ))}
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
