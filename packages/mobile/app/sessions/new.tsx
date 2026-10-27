import { useState } from "react";
import { FlatList } from "react-native";

import {
  getActivePlan, getNextWorkout, listWorkouts
} from "@forklift/core";

import { EmptyState } from "@/components/EmptyState";
import { ListRow, rowPosition } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { startWorkout } from "@/startWorkout";

// Lets the lifter Start a Workout of the Active Plan out of turn.
export default function ChooseWorkoutScreen() {
  const [ workouts ] = useState(() => {
    const plan = getActivePlan();

    return plan ? listWorkouts(plan.id) : [];
  });

  const [ nextId ] = useState(() => getNextWorkout()?.id);

  return (
    <Screen>
      <FlatList
        data={workouts}
        keyExtractor={w => w.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-4"
        ListEmptyComponent={(
          <EmptyState icon="calendar-outline"
            message="The Active Plan has no workouts yet." />
        )}
        renderItem={({ item, index }) => (
          <ListRow title={item.name}
            badge={item.id === nextId ? "Next" : undefined}
            onPress={() => startWorkout(item.id, "replace")}
            {...rowPosition(index, workouts.length)} />
        )}
      />
    </Screen>
  );
}
