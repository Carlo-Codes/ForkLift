import {
  router, Stack, useLocalSearchParams
} from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { getSessionDetail, getSettings } from "@forklift/core";
import type { SessionDetail, SessionDetailEntry } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { formatSessionWhen, formatSet } from "@/format";

function loadDetail(id: string): SessionDetail | undefined {
  try {
    return getSessionDetail(id);
  } catch {
    return undefined;
  }
}

// One Exercise Entry's Logged Sets; its name opens the Exercise's history.
function EntrySets({
  entry, unit, first
}: { entry: SessionDetailEntry; unit: Unit; first: boolean }) {
  return (
    <View className={first ? undefined : "border-t border-separator"}>
      <AppButton className="min-h-touch flex-row items-center gap-2 pl-4 pr-2"
        accessibilityRole="link"
        accessibilityHint="Show this exercise's history"
        onPress={() => router.push({
          pathname: "/history/exercises/[id]",
          params: { id: entry.exerciseId }
        })}>
        <AppText weight="semibold"
          className="flex-1 text-base text-ink">
          {entry.exerciseName}
        </AppText>
        <AppIcon name="chevron-forward"
          color="faint"
          size={18} />
      </AppButton>
      <View className="gap-1 px-4 pb-3">
        {entry.sets.map(set => (
          <View key={set.round}
            className="flex-row gap-3">
            <AppText className="w-12 text-sm text-muted">Set {set.round}</AppText>
            <AppText className={set.skipped ? "text-faint" : "text-ink"}>
              {set.skipped ? "Skipped" : formatSet(set.reps, set.weight, unit)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// One past Session: every Logged Set, by Block and Exercise Entry. A Superset
// is a bordered group, as in the Plan editor's SupersetGroup.
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ detail ] = useState(() => loadDetail(id));
  const [ unit ] = useState(() => getSettings().unit);

  if (!detail) {
    return (
      <Screen className="justify-center">
        <EmptyState icon="alert-circle-outline"
          message="This session no longer exists." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: detail.workoutName }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4">
        <AppText className="text-muted">
          {formatSessionWhen(detail)}
        </AppText>
        {detail.blocks.map((entries, b) => {
          const rows = entries.map((entry, e) => (
            <EntrySets key={entry.exerciseEntryId}
              entry={entry}
              unit={unit}
              first={e === 0} />
          ));

          return entries.length > 1 ?
            (
              <View key={b}
                className="overflow-hidden rounded-2xl border-2 border-accent-soft bg-surface">
                <AppText weight="semibold"
                  className="bg-accent-soft px-4 py-2 text-accent">
                  Superset
                </AppText>
                {rows}
              </View>
            ) :
              <Card key={b}>{rows}</Card>;
        })}
      </ScrollView>
    </Screen>
  );
}
