import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import {
  MAX_NEW_PLAN_WORKOUTS, MAX_PLAN_WEEKS, newPlanDefaults, newPlanWorkoutNames
} from "@forklift/core";
import type { NewPlanPayload } from "@forklift/core";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { Card } from "./Card";
import { DateChip } from "./DateChip";
import { Screen } from "./Screen";
import { Stepper } from "./Stepper";

import { errorMessage } from "@/errorMessage";
import { formatList } from "@/format";

interface NewPlanFormProps {
  // Throws (e.g. a ValidationError from @forklift/core) to keep the form open
  // with the message shown.
  onCreate: (payload: NewPlanPayload) => void;
}

// A new Plan's name, start date, length in weeks and number of Workouts,
// opening on today, 8 weeks and Push, Pull and Legs (ADR-0006, ADR-0007).
// Nothing is saved until Create.
export function NewPlanForm({ onCreate }: NewPlanFormProps) {
  const [ form, setForm ] = useState(() => newPlanDefaults());
  const [ error, setError ] = useState<string>();
  // The ref blocks a second tap before the disabled state re-renders; on
  // success the form stays disabled because the Plan editor replaces it.
  const creatingRef = useRef(false);
  const [ creating, setCreating ] = useState(false);
  const workoutNames = newPlanWorkoutNames(form.workoutCount);

  const change = (changes: Partial<NewPlanPayload>) => setForm(current => ({
    ...current,
    ...changes
  }));

  const create = () => {
    if (creatingRef.current) return;

    creatingRef.current = true;
    setCreating(true);

    try {
      onCreate(form);
    } catch (e) {
      creatingRef.current = false;
      setCreating(false);
      setError(errorMessage(e));
    }
  };

  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 p-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View className="gap-2">
          <AppText weight="semibold"
            className="px-1 text-sm text-muted">
            Name
          </AppText>
          <AppTextInput value={form.name}
            onChangeText={name => change({ name })}
            placeholder="e.g. Push / Pull / Legs"
            accessibilityLabel="Plan name" />
        </View>
        <Card className="gap-4 p-3">
          <View className="flex-row">
            <DateChip label="Start"
              day={form.startDate}
              fallback={form.startDate}
              required
              onChange={startDate => startDate && change({ startDate })} />
          </View>
          <Stepper label="Weeks"
            value={form.weeks}
            step={1}
            min={1}
            max={MAX_PLAN_WEEKS}
            onChange={weeks => change({ weeks })} />
          <View className="gap-1">
            <Stepper label="Workouts"
              value={form.workoutCount}
              step={1}
              min={1}
              max={MAX_NEW_PLAN_WORKOUTS}
              onChange={workoutCount => change({ workoutCount })} />
            {workoutNames.length > 0 && (
              <AppText className="text-sm text-muted">
                Starts with empty {formatList(workoutNames)} workouts you can rename.
              </AppText>
            )}
          </View>
        </Card>
        {error && <AppText className="text-danger">{error}</AppText>}
        <AppButton variant="primary"
          disabled={creating}
          onPress={create}>
          Create
        </AppButton>
      </ScrollView>
    </Screen>
  );
}
