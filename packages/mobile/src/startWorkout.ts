import { router } from "expo-router";
import { Alert } from "react-native";

import { startSession } from "@forklift/core";

// Starts a Session of the Workout and opens Workout Mode in place of the
// current screen (replace) or on top of it (push).
export function startWorkout(workoutId: string, navigate: "push" | "replace" = "push") {
  try {
    const { id } = startSession(workoutId);

    router[ navigate ]({
      pathname: "/sessions/[id]",
      params: { id }
    });
  } catch (e) {
    Alert.alert("Can't start this workout", e instanceof Error ? e.message : String(e));
  }
}
