import {
  router, useFocusEffect, useLocalSearchParams
} from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert, FlatList, View
} from "react-native";

import {
  createWorkout,
  deletePlan,
  getPlan,
  listWorkouts,
  reorderWorkouts,
  setActivePlan,
  updatePlan
} from "@forklift/core";
import type { PlanAttributes, WorkoutAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { NameInput } from "@/components/NameInput";
import { moveId, OrderedRow } from "@/components/OrderedRow";

interface PlanState {
  plan: PlanAttributes;
  workouts: WorkoutAttributes[];
}

function loadPlan(id: string): PlanState | undefined {
  try {
    return {
      plan: getPlan(id),
      workouts: listWorkouts(id)
    };
  } catch {
    return undefined;
  }
}

export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ state, setState ] = useState(() => loadPlan(id));
  const refresh = useCallback(() => setState(loadPlan(id)), [ id ]);

  useFocusEffect(refresh);

  if (!state) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This plan no longer exists.</AppText>
      </View>
    );
  }

  const { plan, workouts } = state;

  const move = (index: number, delta: -1 | 1) => {
    reorderWorkouts(plan.id, moveId(workouts.map(w => w.id), index, delta));
    refresh();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${plan.name}?`,
      "Its Workouts are deleted too. Past Sessions are kept.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deletePlan(plan.id);
            router.back();
          }
        }
      ]
    );
  };

  return (
    <FlatList
      className="flex-1 bg-brand-white"
      data={workouts}
      keyExtractor={w => w.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View className="gap-4 p-4">
          <NameInput
            key={plan.id}
            initial={plan.name}
            placeholder="Plan name"
            submitLabel="Rename"
            onSubmit={name => {
              updatePlan(plan.id, { name });
              refresh();
            }}
          />
          <AppButton
            variant="chip"
            className="self-start"
            selected={plan.isActive}
            accessibilityRole="switch"
            accessibilityState={{ checked: plan.isActive }}
            onPress={() => {
              setActivePlan(plan.isActive ? null : plan.id);
              refresh();
            }}
          >
            {plan.isActive ? "Active Plan ✓" : "Make Active Plan"}
          </AppButton>
          <AppText weight="semibold"
            className="text-lg text-brand-darkGray">
            Workouts
          </AppText>
          <NameInput
            placeholder="New workout name"
            submitLabel="Add workout"
            clearOnSubmit
            onSubmit={name => {
              createWorkout(plan.id, { name });
              refresh();
            }}
          />
        </View>
      )}
      ListEmptyComponent={(
        <AppText className="px-4 text-brand-mediumGray">
          No workouts yet. Add one, e.g. &quot;Push&quot;.
        </AppText>
      )}
      renderItem={({ item, index }) => (
        <OrderedRow
          title={item.name}
          onPress={() => router.push({
            pathname: "/workouts/[id]",
            params: { id: item.id }
          })}
          onMoveUp={index > 0 ? () => move(index, -1) : undefined}
          onMoveDown={index < workouts.length - 1 ? () => move(index, 1) : undefined}
        />
      )}
      ListFooterComponent={(
        <AppButton className="items-center p-4"
          onPress={confirmDelete}>
          <AppText className="text-brand-error">Delete plan</AppText>
        </AppButton>
      )}
    />
  );
}
