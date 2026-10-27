import {
  router, useFocusEffect, useLocalSearchParams
} from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import {
  getPlan, getPlanCalendar, toCalendarDay
} from "@forklift/core";
import type {
  PlanCalendar, PlanCalendarDay, PlanCalendarSession
} from "@forklift/core";

import { AppText } from "@/components/AppText";
import { EmptyState } from "@/components/EmptyState";
import { ListRow, rowPosition } from "@/components/ListRow";
import { PlanCalendarGrid } from "@/components/PlanCalendarGrid";
import { Screen } from "@/components/Screen";
import { formatDate } from "@/format";

interface CalendarState {
  planName: string;
  calendar: PlanCalendar;
  today: string;
}

function loadCalendar(planId: string): CalendarState | undefined {
  try {
    const today = toCalendarDay(new Date());

    return {
      planName: getPlan(planId).name,
      calendar: getPlanCalendar(planId, today),
      today
    };
  } catch {
    return undefined;
  }
}

// Opens a past Session on History's Session detail screen.
const openSession = (session: PlanCalendarSession) => router.push({
  pathname: "/history/sessions/[id]",
  params: { id: session.id }
});

// A Plan's finished Sessions day by day. Tapping a day opens its Session, or,
// for a day with several, lists them to pick from under the grid.
export default function PlanCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ state, setState ] = useState(() => loadCalendar(id));
  // The day with several Sessions whose list shows.
  const [ picking, setPicking ] = useState<PlanCalendarDay>();

  useFocusEffect(useCallback(() => {
    setState(loadCalendar(id));
    setPicking(undefined);
  }, [ id ]));

  if (!state) {
    return (
      <Screen className="justify-center">
        <EmptyState icon="alert-circle-outline"
          message="This plan no longer exists." />
      </Screen>
    );
  }

  const pressDay = (day: PlanCalendarDay) => {
    if (day.sessions.length === 1) {
      openSession(day.sessions[ 0 ]!);
    } else {
      setPicking(current => (current?.day === day.day ? undefined : day));
    }
  };

  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4">
        <AppText className="text-muted">{state.planName}</AppText>
        {state.calendar.weeks.length > 0 ?
          (
            <PlanCalendarGrid calendar={state.calendar}
              today={state.today}
              onPressDay={pressDay} />
          ) :
          (
            <EmptyState icon="calendar-outline"
              message="Finished workouts of this plan show up here." />
          )}
        {picking && (
          <View className="gap-2">
            <AppText weight="semibold"
              className="text-ink">
              {formatDate(picking.sessions[ 0 ]!.startedAt)}
            </AppText>
            <View>
              {picking.sessions.map((session, i) => (
                <ListRow key={session.id}
                  title={session.workoutName}
                  subtitle={session.startedAt.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                  onPress={() => openSession(session)}
                  {...rowPosition(i, picking.sessions.length)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
