import { useState } from "react";
import { ScrollView, View } from "react-native";

import { equipmentValues, muscleGroupValues } from "@forklift/db/client";
import type {
  Equipment, ExerciseCreatePayload, MuscleGroup
} from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

interface ExerciseFormProps {
  initial?: ExerciseCreatePayload;
  submitLabel: string;
  // Throws (e.g. a ValidationError from @forklift/core) to keep the form open with
  // the message shown.
  onSubmit: (payload: ExerciseCreatePayload) => void;
  children?: React.ReactNode;
}

const INPUT_CLASS = "rounded-lg border border-brand-lightGray px-3 py-2 text-brand-darkGray";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <AppText weight="semibold"
        className="text-brand-darkGray">
        {label}
      </AppText>
      {children}
    </View>
  );
}

export function ExerciseForm({
  initial, submitLabel, onSubmit, children
}: ExerciseFormProps) {
  const [ name, setName ] = useState(initial?.name ?? "");
  const [ muscleGroups, setMuscleGroups ] = useState<MuscleGroup[]>(initial?.muscleGroups ?? []);
  const [ equipment, setEquipment ] = useState<Equipment | null>(initial?.equipment ?? null);
  const [ notes, setNotes ] = useState(initial?.notes ?? "");
  const [ error, setError ] = useState<string>();

  const toggleMuscleGroup = (group: MuscleGroup) => {
    setMuscleGroups(current => (current.includes(group) ?
      current.filter(g => g !== group) :
      [ ...current, group ]));
  };

  const submit = () => {
    try {
      onSubmit({
        name,
        muscleGroups,
        equipment,
        notes: notes.trim() || null
      });
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView className="flex-1 bg-brand-white"
      contentContainerClassName="gap-4 p-6"
      keyboardShouldPersistTaps="handled">
      <Field label="Name">
        <AppTextInput className={INPUT_CLASS}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Barbell Bench Press" />
      </Field>
      <Field label="Muscle groups">
        <View className="flex-row flex-wrap gap-2">
          {muscleGroupValues.map(group => (
            <AppButton
              key={group}
              variant="chip"
              selected={muscleGroups.includes(group)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: muscleGroups.includes(group) }}
              onPress={() => toggleMuscleGroup(group)}
            >
              {group}
            </AppButton>
          ))}
        </View>
      </Field>
      <Field label="Equipment">
        <View className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup">
          {equipmentValues.map(value => (
            <AppButton
              key={value}
              variant="chip"
              selected={value === equipment}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === equipment }}
              onPress={() => setEquipment(current => (current === value ? null : value))}
            >
              {value}
            </AppButton>
          ))}
        </View>
      </Field>
      <Field label="Notes">
        <AppTextInput className={`${INPUT_CLASS} min-h-24`}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="Setup cues, seat height…" />
      </Field>
      {error && <AppText className="text-brand-error">{error}</AppText>}
      <AppButton variant="primary"
        onPress={submit}>
        {submitLabel}
      </AppButton>
      {children}
    </ScrollView>
  );
}
