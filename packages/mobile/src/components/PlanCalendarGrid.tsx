import { Pressable, View } from "react-native";

import type {
  PlanCalendar, PlanCalendarDay, PlanCalendarWeek
} from "@forklift/core";

import { AppText } from "./AppText";
import { Card } from "./Card";

import {
  formatCalendarDay, formatWeekdayLetter, formatWorkoutLetters
} from "@/format";

const LABEL_CLASS = "w-16 pr-1";

// One day: its date, and a filled dot with the Workouts' first letters when
// it has finished Sessions. Today is outlined, and a day outside the Plan's
// dates is dimmed. Only a day with Sessions can be tapped.
function DayCell({
  day, today, onPress
}: { day: PlanCalendarDay; today: string; onPress: (day: PlanCalendarDay) => void }) {
  const hasSessions = day.sessions.length > 0;
  const isToday = day.day === today;

  const className = [
    "aspect-square flex-1 items-center justify-center gap-0.5 rounded-lg border-2 active:opacity-60",
    isToday ? "border-accent" : "border-transparent",
    !day.inPlan && "opacity-40"
  ].filter(Boolean).join(" ");

  const accessibilityLabel = [
    formatCalendarDay(day.day),
    isToday && "today",
    ...day.sessions.map(s => s.workoutName),
    !day.inPlan && "outside the plan's dates"
  ].filter(Boolean).join(", ");

  return (
    <Pressable className={className}
      disabled={!hasSessions}
      accessibilityRole={hasSessions ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(day)}>
      <AppText className={`text-xs ${isToday ? "text-accent" : "text-muted"}`}>
        {Number(day.day.slice(8))}
      </AppText>
      {hasSessions ?
        (
          <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1">
            <AppText weight="semibold"
              className="text-[10px] text-on-accent">
              {formatWorkoutLetters(day.sessions)}
            </AppText>
          </View>
        ) :
          <View className="h-5" />}
    </Pressable>
  );
}

// "Week 3" and the date the row starts, or just the date for a row outside
// the Plan's weeks.
function WeekLabel({ week }: { week: PlanCalendarWeek }) {
  return (
    <View className={LABEL_CLASS}>
      {week.planWeek !== null && (
        <AppText weight="semibold"
          className="text-xs text-ink">
          Week {week.planWeek}
        </AppText>
      )}
      <AppText className="text-xs text-muted">{formatCalendarDay(week.days[ 0 ]!.day, false)}</AppText>
    </View>
  );
}

// A Plan Calendar (GLOSSARY): one row per Plan Week, each starting on the
// weekday of the Plan's From date.
export function PlanCalendarGrid({
  calendar, today, onPressDay
}: { calendar: PlanCalendar; today: string; onPressDay: (day: PlanCalendarDay) => void }) {
  const [ first ] = calendar.weeks;

  if (!first) {
    return null;
  }

  return (
    <Card className="gap-1 p-2">
      <View className="flex-row items-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <View className={LABEL_CLASS} />
        {first.days.map(d => (
          <AppText key={d.day}
            className="flex-1 text-center text-xs text-muted">
            {formatWeekdayLetter(d.day)}
          </AppText>
        ))}
      </View>
      {calendar.weeks.map(week => (
        <View key={week.days[ 0 ]!.day}
          className="flex-row items-center">
          <WeekLabel week={week} />
          {week.days.map(day => (
            <DayCell key={day.day}
              day={day}
              today={today}
              onPress={onPressDay} />
          ))}
        </View>
      ))}
    </Card>
  );
}
