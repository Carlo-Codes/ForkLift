import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import {
  createPlan, listPlans, reorderPlans
} from "@forklift/core";
import type { PlanAttributes } from "@forklift/db/client";

import { AppText } from "@/components/AppText";
import { NameInput } from "@/components/NameInput";
import { rowPosition } from "@/components/ListRow";
import { moveId, OrderedRow } from "@/components/OrderedRow";
import { Screen } from "@/components/Screen";

export default function PlansScreen() {
  const [ plans, setPlans ] = useState<PlanAttributes[]>([]);
  const refresh = useCallback(() => setPlans(listPlans()), []);

  // Re-read on focus so renames, deletes and the Active Plan show when coming back.
  useFocusEffect(refresh);

  const move = (index: number, delta: -1 | 1) => {
    reorderPlans(moveId(plans.map(p => p.id), index, delta));
    refresh();
  };

  return (
    <Screen>
      <View className="p-4">
        <NameInput
          placeholder="New plan name"
          submitLabel="Add plan"
          clearOnSubmit
          onSubmit={name => {
            createPlan({ name });
            refresh();
          }}
        />
      </View>
      <FlatList
        data={plans}
        keyExtractor={p => p.id}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <AppText className="text-muted">
            No plans yet. Add one, e.g. &quot;Push / Pull / Legs&quot;.
          </AppText>
        )}
        renderItem={({ item, index }) => (
          <OrderedRow
            title={item.name}
            badge={item.isActive ? "Active" : undefined}
            onPress={() => router.push({
              pathname: "/plans/[id]",
              params: { id: item.id }
            })}
            onMoveUp={index > 0 ? () => move(index, -1) : undefined}
            onMoveDown={index < plans.length - 1 ? () => move(index, 1) : undefined}
            {...rowPosition(index, plans.length)}
          />
        )}
      />
    </Screen>
  );
}
