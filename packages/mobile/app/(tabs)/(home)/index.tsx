import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import { getHomeCard } from "@forklift/core";
import type { HomeEntry, PlanProgress } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Chip";
import { PlanProgressBar } from "@/components/PlanProgressBar";
import { Screen } from "@/components/Screen";
import { formatEntrySummary } from "@/format";
import { startWorkout } from "@/startWorkout";

// A Workout at a glance: its name, its Plan (with how far through it the
// lifter is, for the Active Plan's) and its Exercise Entries.
function WorkoutCard({
  badge, workoutName, planName, progress, entries
}: { badge?: string; workoutName: string; planName?: string; progress?: PlanProgress; entries: HomeEntry[] }) {
  return (
    <Card className="gap-1 p-5">
      {badge && (
        <View className="mb-1 flex-row">
          <Badge>{badge}</Badge>
        </View>
      )}
      {workoutName !== "" && (
        <AppText weight="semibold"
          className="text-2xl text-ink">
          {workoutName}
        </AppText>
      )}
      {planName && <AppText className="text-muted">{planName}</AppText>}
      <AppText numberOfLines={2}
        className="mt-2 text-sm text-ink">
        {entries.length > 0 ? formatEntrySummary(entries) : "No exercises yet"}
      </AppText>
      {progress && (
        <PlanProgressBar planWeek={progress.planWeek}
          className="mt-3" />
      )}
    </Card>
  );
}

// A card with a message and the one action that gets the lifter going.
function PromptCard({
  message, action, onPress
}: { message: string; action: string; onPress: () => void }) {
  return (
    <Card className="gap-3 p-5">
      <AppText className="text-ink">{message}</AppText>
      <AppButton variant="primary"
        onPress={onPress}>
        {action}
      </AppButton>
    </Card>
  );
}

export default function HomeScreen() {
  const [ card, setCard ] = useState(getHomeCard);

  // Re-read on focus: a finished Session, a new Active Plan or edited Workout.
  useFocusEffect(useCallback(() => setCard(getHomeCard()), []));

  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 p-4">
        {card.kind === "resume" && (
          <>
            <WorkoutCard badge="In progress"
              {...card} />
            <AppButton variant="primary"
              onPress={() => router.push({
                pathname: "/sessions/[id]",
                params: { id: card.sessionId }
              })}>
              Resume
            </AppButton>
          </>
        )}
        {card.kind === "next" && (
          <>
            <WorkoutCard {...card} />
            <AppButton variant="primary"
              onPress={() => startWorkout(card.workoutId)}>
              Start
            </AppButton>
            <AppButton variant="link"
              onPress={() => router.push("/sessions/new")}>
              Choose another
            </AppButton>
          </>
        )}
        {card.kind === "emptyPlan" && (
          <PromptCard message={`${card.planName} has no workouts yet. Add one to start training.`}
            action="Add a workout"
            onPress={() => router.push({
              pathname: "/plans/[id]",
              params: { id: card.planId }
            })} />
        )}
        {card.kind === "noPlan" && (
          <PromptCard message="No Active Plan yet. Create one, or make one Active, and its next Workout shows up here."
            action="Create a plan"
            onPress={() => router.navigate("/plans")} />
        )}
      </ScrollView>
    </Screen>
  );
}
