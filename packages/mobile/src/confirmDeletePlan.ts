import { Alert } from "react-native";

import { deletePlan } from "@forklift/core";

// Asks before deleting the Plan, then calls onDeleted once it's gone.
export function confirmDeletePlan(plan: { id: string; name: string }, onDeleted: () => void) {
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
          onDeleted();
        }
      }
    ]
  );
}
