import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert, FlatList, Pressable, View
} from "react-native";

import { listPlanCards, setActivePlan } from "@forklift/core";
import type { PlanListItem } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { confirmDeletePlan } from "@/confirmDeletePlan";
import { formatPlanDates } from "@/format";

// Long-press actions: make the Plan Active (unless it is already), or delete it.
const showActions = (plan: PlanListItem, onChanged: () => void) => Alert.alert(plan.name, undefined, [
  ...(plan.isActive ?
    [] :
    [
      {
        text: "Make Active Plan",
        onPress: () => {
          setActivePlan(plan.id);
          onChanged();
        }
      }
    ]),
  {
    text: "Delete",
    style: "destructive" as const,
    onPress: () => confirmDeletePlan(plan, onChanged)
  },
  {
    text: "Cancel",
    style: "cancel" as const
  }
]);

// A Plan at a glance: its name, dates, Workouts, and whether it's Active or Ended.
function PlanCard({
  plan, onPress, onLongPress
}: { plan: PlanListItem; onPress: () => void; onLongPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint="Long-press to make it the Active Plan or delete it"
      className="active:opacity-70">
      <Card className="gap-1 p-4">
        <View className="flex-row items-center gap-2">
          <AppText weight="semibold"
            numberOfLines={1}
            className="shrink text-lg text-ink">
            {plan.name}
          </AppText>
          {plan.isActive && <Badge>Active</Badge>}
          {plan.ended && <Badge muted>Ended</Badge>}
        </View>
        <AppText className="text-sm text-muted">{formatPlanDates(plan)}</AppText>
        <AppText numberOfLines={2}
          className="text-sm text-ink">
          {plan.workoutNames.length > 0 ? plan.workoutNames.join(" · ") : "No workouts yet"}
        </AppText>
      </Card>
    </Pressable>
  );
}

export default function PlansScreen() {
  const [ plans, setPlans ] = useState(() => listPlanCards());
  const refresh = useCallback(() => setPlans(listPlanCards()), []);

  // Re-read on focus so new Plans, edits, deletes and the Active Plan show
  // when coming back.
  useFocusEffect(refresh);

  return (
    <Screen>
      <FlatList
        data={plans}
        keyExtractor={p => p.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 p-4"
        ListEmptyComponent={(
          <AppText className="text-muted">
            No plans yet. Create one, e.g. &quot;Push / Pull / Legs&quot;.
          </AppText>
        )}
        renderItem={({ item }) => (
          <PlanCard plan={item}
            onPress={() => router.push({
              pathname: "/plans/[id]",
              params: { id: item.id }
            })}
            onLongPress={() => showActions(item, refresh)} />
        )}
      />
      {/* Pinned above the tab bar, outside the scrolling list, full width but
          no taller than any other button. */}
      <View className="px-4 pb-3 pt-2">
        <AppButton variant="primary"
          onPress={() => router.push("/plans/new")}>
          Create plan
        </AppButton>
      </View>
    </Screen>
  );
}
