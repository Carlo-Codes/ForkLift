import { useState } from "react";
import { FlatList } from "react-native";

import {
  getActivePlan, getNextWorkout, listWorkouts
} from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { startWorkout } from "@/startWorkout";

// Lets the lifter Start a Workout of the Active Plan out of turn.
export default function ChooseWorkoutScreen() {
  const [ workouts ] = useState(() => {
    const plan = getActivePlan();

    return plan ? listWorkouts(plan.id) : [];
  });

  const [ nextId ] = useState(() => getNextWorkout()?.id);

  return (
    <FlatList
      className="flex-1 bg-brand-white"
      data={workouts}
      keyExtractor={w => w.id}
      ListEmptyComponent={(
        <AppText className="p-4 text-brand-mediumGray">The Active Plan has no workouts yet.</AppText>
      )}
      renderItem={({ item }) => (
        <AppButton className="border-b border-brand-lighterGray px-4 py-4"
          accessibilityRole="button"
          onPress={() => startWorkout(item.id, "replace")}>
          <AppText className="text-brand-darkGray">
            {item.name}
            {item.id === nextId && <AppText className="text-brand-mediumGray"> · next</AppText>}
          </AppText>
        </AppButton>
      )}
    />
  );
}
