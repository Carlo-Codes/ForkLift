import {
  Link, router, useFocusEffect
} from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { getNextWorkout, resumeSession } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { startWorkout } from "@/startWorkout";

export default function HomeScreen() {
  const [ next, setNext ] = useState(() => getNextWorkout());
  // A Session left in progress (the app closed or crashed mid-workout).
  const [ inProgress, setInProgress ] = useState(() => resumeSession()?.session);

  useFocusEffect(useCallback(() => {
    setNext(getNextWorkout());
    setInProgress(resumeSession()?.session);
  }, []));

  return (
    <View className="flex-1 justify-between bg-brand-white p-6">
      <View className="flex-1 justify-center gap-3">
        {inProgress ?
          (
            <AppButton variant="primary"
              className="py-8"
              onPress={() => router.push({
                pathname: "/sessions/[id]",
                params: { id: inProgress.id }
              })}>
              <AppText weight="semibold"
                className="text-2xl text-brand-white">
                Resume workout
              </AppText>
            </AppButton>
          ) :
          next ?
            (
              <>
                <AppButton variant="primary"
                  className="py-8"
                  onPress={() => startWorkout(next.id)}>
                  <AppText weight="semibold"
                    className="text-2xl text-brand-white">
                    Start {next.name}
                  </AppText>
                </AppButton>
                <Link href="/sessions/new"
                  asChild>
                  <AppButton className="items-center p-2">
                    <AppText className="text-brand-primary">Choose a different workout</AppText>
                  </AppButton>
                </Link>
              </>
            ) :
            (
              <AppText className="text-center text-brand-mediumGray">
                Make a Plan Active and add a Workout to it to start training.
              </AppText>
            )}
      </View>
      <View className="gap-3">
        <Link href="/plans"
          asChild>
          <AppButton variant="outline">Plans</AppButton>
        </Link>
        <Link href="/history"
          asChild>
          <AppButton variant="outline">History</AppButton>
        </Link>
        <Link href="/exercises"
          asChild>
          <AppButton variant="outline">Exercise Library</AppButton>
        </Link>
        <Link href="/settings"
          asChild>
          <AppButton variant="outline">Settings</AppButton>
        </Link>
      </View>
    </View>
  );
}
