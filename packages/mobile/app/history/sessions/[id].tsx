import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { getSessionDetail, getSettings } from "@forklift/core";
import type { SessionDetail } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
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
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This session no longer exists.</AppText>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-brand-white"
      contentContainerClassName="gap-4 p-4">
      <AppText weight="semibold"
        className="text-xl text-brand-darkGray">
        {detail.workoutName} · {formatDate(detail.startedAt)}
      </AppText>
      {detail.blocks.map((entries, b) => (
        <View key={b}
          className="gap-3 rounded-lg border border-brand-lighterGray p-3">
          {entries.length > 1 && <AppText className="text-sm text-brand-primary">Superset</AppText>}
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
                  className="text-brand-darkGray">
                  {entry.exerciseName}
                </AppText>
              </AppButton>
              {entry.sets.map(set => (
                <AppText key={set.round}
                  className={set.skipped ? "text-brand-lightGray" : "text-brand-mediumGray"}>
                  Set {set.round}: {set.skipped ? "skipped" : formatSet(set.reps, set.weight, unit)}
                </AppText>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
