import { View } from "react-native";

import type { PlanWeek } from "@forklift/core";

import { AppText } from "./AppText";

import { formatPlanWeek, planWeekFraction } from "@/format";

// How far through a Plan the lifter is: "Week 3 of 6" over a thin bar that
// fills by Plan Week. A Plan with no dates shows nothing, and one with no To
// date just its week, with no total to fill a bar towards.
export function PlanProgressBar({ planWeek, className }: { planWeek: PlanWeek | null; className?: string }) {
  if (!planWeek) {
    return null;
  }

  const label = formatPlanWeek(planWeek);
  const fraction = planWeekFraction(planWeek);

  return (
    <View className={`gap-1${className ? ` ${className}` : ""}`}>
      <AppText className="text-sm text-muted">{label}</AppText>
      {fraction !== null && (
        <View className="h-1 overflow-hidden rounded-full bg-fill"
          accessibilityRole="progressbar"
          accessibilityLabel={label}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(fraction * 100)
          }}>
          <View className="h-full rounded-full bg-accent"
            style={{ width: `${fraction * 100}%` }} />
        </View>
      )}
    </View>
  );
}
