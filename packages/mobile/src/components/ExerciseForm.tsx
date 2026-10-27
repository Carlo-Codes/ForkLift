import { useState } from "react";
import { ScrollView, View } from "react-native";

import { equipmentValues, muscleGroupValues } from "@forklift/db/client";
import type {
  Equipment, ExerciseCreatePayload, MuscleGroup
} from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { Screen } from "./Screen";

interface ExerciseFormProps {
  initial?: ExerciseCreatePayload;
  submitLabel: string;
  // Throws (e.g. a ValidationError from @forklift/core) to keep the form open with
  // the message shown.
  onSubmit: (payload: ExerciseCreatePayload) => void;
  children?: React.ReactNode;
}

// A labelled group of the form on its own card.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <AppText weight="semibold"
        className="px-1 text-sm text-muted">
        {label}
      </AppText>
      <Card className="p-3">{children}</Card>
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
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 p-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Field label="Name">
          <AppTextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Barbell Bench Press" />
        </Field>
        <Field label="Muscle groups">
          <View className="flex-row flex-wrap gap-2">
            {muscleGroupValues.map(group => (
              <Chip
                key={group}
                selected={muscleGroups.includes(group)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: muscleGroups.includes(group) }}
                onPress={() => toggleMuscleGroup(group)}
            >
                {group}
              </Chip>
            ))}
          </View>
        </Field>
        <Field label="Equipment">
          <View className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup">
            {equipmentValues.map(value => (
              <Chip
                key={value}
                selected={value === equipment}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === equipment }}
                onPress={() => setEquipment(current => (current === value ? null : value))}
            >
                {value}
              </Chip>
            ))}
          </View>
        </Field>
        <Field label="Notes">
          <AppTextInput style={{ minHeight: 96 }}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Setup cues, seat height…" />
        </Field>
        {error && <AppText className="text-danger">{error}</AppText>}
        <AppButton variant="primary"
          onPress={submit}>
          {submitLabel}
        </AppButton>
        {children}
      </ScrollView>
    </Screen>
  );
}
