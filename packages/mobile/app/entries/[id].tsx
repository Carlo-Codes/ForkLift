import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert, ScrollView, View
} from "react-native";

import {
  deleteExerciseEntry, getBlock, getExerciseEntry, getSettings, updateExerciseEntry
} from "@forklift/core";
import type { ExerciseAttributes, ExerciseEntryAttributes } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { toNumber } from "@/format";

const INPUT_CLASS = "rounded-lg border border-brand-lightGray px-3 py-2 text-brand-darkGray";

type Targets = Pick<
  ExerciseEntryAttributes,
  "targetSets" | "targetReps" | "targetWeight" | "restSeconds" | "weightStep"
>;

function loadEntry(id: string): (ExerciseEntryAttributes & { exercise: ExerciseAttributes }) | undefined {
  try {
    const { blockId } = getExerciseEntry(id);

    return getBlock(blockId).exerciseEntries.find(e => e.id === id);
  } catch {
    return undefined;
  }
}

function TargetField({
  label, value, onChangeText, decimal
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  decimal?: boolean;
}) {
  return (
    <View className="flex-1 gap-1">
      <AppText weight="semibold"
        className="text-brand-darkGray">
        {label}
      </AppText>
      <AppTextInput className={INPUT_CLASS}
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        accessibilityLabel={label}
        selectTextOnFocus />
    </View>
  );
}

export default function ExerciseEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ entry ] = useState(() => loadEntry(id));
  const [ unit ] = useState(() => getSettings().unit);

  const [ fields, setFields ] = useState<Record<keyof Targets, string>>(() => ({
    targetSets: String(entry?.targetSets ?? ""),
    targetReps: String(entry?.targetReps ?? ""),
    targetWeight: String(entry?.targetWeight ?? ""),
    restSeconds: String(entry?.restSeconds ?? ""),
    weightStep: String(entry?.weightStep ?? "")
  }));

  const [ error, setError ] = useState<string>();

  if (!entry) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This exercise is no longer in the workout.</AppText>
      </View>
    );
  }

  const field = (key: keyof Targets) => ({
    value: fields[ key ],
    onChangeText: (text: string) => setFields(current => ({
      ...current,
      [ key ]: text
    }))
  });

  const save = () => {
    try {
      updateExerciseEntry(entry.id, {
        targetSets: toNumber(fields.targetSets),
        targetReps: toNumber(fields.targetReps),
        targetWeight: toNumber(fields.targetWeight),
        restSeconds: toNumber(fields.restSeconds),
        weightStep: toNumber(fields.weightStep)
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      `Remove ${entry.exercise.name}?`,
      "It's removed from this workout. Past Sessions are kept.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            deleteExerciseEntry(entry.id);
            router.back();
          }
        }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-brand-white"
      contentContainerClassName="gap-4 p-6"
      keyboardShouldPersistTaps="handled">
      <AppText weight="semibold"
        className="text-lg text-brand-darkGray">
        {entry.exercise.name}
      </AppText>
      <View className="flex-row gap-3">
        <TargetField label="Sets"
          {...field("targetSets")} />
        <TargetField label="Reps"
          {...field("targetReps")} />
      </View>
      <View className="flex-row gap-3">
        <TargetField label={`Weight (${unit})`}
          decimal
          {...field("targetWeight")} />
        <TargetField label={`Weight Step (${unit})`}
          decimal
          {...field("weightStep")} />
      </View>
      <View className="flex-row gap-3">
        <TargetField label="Rest (seconds)"
          {...field("restSeconds")} />
        <View className="flex-1" />
      </View>
      {error && <AppText className="text-brand-error">{error}</AppText>}
      <AppButton variant="primary"
        onPress={save}>
        Save
      </AppButton>
      <AppButton className="items-center p-4"
        onPress={confirmRemove}>
        <AppText className="text-brand-error">Remove from workout</AppText>
      </AppButton>
    </ScrollView>
  );
}
