import {
  Link, router, useFocusEffect
} from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { getNextWorkout, resumeSession } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import type { IconName } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { startWorkout } from "@/startWorkout";

const SECTIONS: { href: "/plans" | "/history" | "/exercises" | "/settings"; label: string; icon: IconName }[] = [
  {
    href: "/plans",
    label: "Plans",
    icon: "calendar-outline"
  },
  {
    href: "/history",
    label: "History",
    icon: "time-outline"
  },
  {
    href: "/exercises",
    label: "Exercise Library",
    icon: "barbell-outline"
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings-outline"
  }
];

export default function HomeScreen() {
  const [ next, setNext ] = useState(() => getNextWorkout());
  // A Session left in progress (the app closed or crashed mid-workout).
  const [ inProgress, setInProgress ] = useState(() => resumeSession()?.session);

  useFocusEffect(useCallback(() => {
    setNext(getNextWorkout());
    setInProgress(resumeSession()?.session);
  }, []));

  return (
    <Screen className="justify-between gap-6 p-4">
      <Card className="flex-1 justify-center gap-3 p-6">
        {inProgress ?
          (
            <AppButton variant="primary"
              onPress={() => router.push({
                pathname: "/sessions/[id]",
                params: { id: inProgress.id }
              })}>
              Resume workout
            </AppButton>
          ) :
          next ?
            (
              <>
                <AppText weight="semibold"
                  className="text-center text-2xl text-ink">
                  {next.name}
                </AppText>
                <AppButton variant="primary"
                  onPress={() => startWorkout(next.id)}>
                  Start
                </AppButton>
                <Link href="/sessions/new"
                  asChild>
                  <AppButton variant="link">Choose a different workout</AppButton>
                </Link>
              </>
            ) :
            (
              <AppText className="text-center text-muted">
                Make a Plan Active and add a Workout to it to start training.
              </AppText>
            )}
      </Card>
      <View className="flex-row flex-wrap gap-3">
        {SECTIONS.map(section => (
          <Link key={section.href}
            href={section.href}
            asChild>
            <AppButton className="min-h-touch min-w-[45%] flex-1 flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3">
              <AppIcon name={section.icon}
                color="accent"
                size={20} />
              <AppText weight="semibold"
                className="text-ink">
                {section.label}
              </AppText>
            </AppButton>
          </Link>
        ))}
      </View>
    </Screen>
  );
}
