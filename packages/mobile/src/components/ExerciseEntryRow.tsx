import { View } from "react-native";

import type { BlockWithEntries } from "@forklift/core";
import { exerciseEntrySchema } from "@forklift/db/client";
import type { ExerciseEntryUpdatePayload, Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { rowSurfaceClass } from "./ListRow";
import { OrderedRow } from "./OrderedRow";
import { Stepper } from "./Stepper";

import { formatTargets } from "@/format";

export type Entry = BlockWithEntries["exerciseEntries"][number];

// How the Plan editor edits Exercise Entries in place: one row's editor is
// open at a time, opened by a long-press.
export interface EntryEditing {
  editingId: string | undefined;
  // The last write that failed, on the Exercise Entry or Superset it was for.
  error: { id: string; message: string } | undefined;
  onEdit: (entry: Entry) => void;
  onChange: (entry: Entry, changes: ExerciseEntryUpdatePayload) => void;
  onRemove: (entry: Entry) => void;
  // A touch on the open editor, which shouldn't close it.
  onTouchInside: () => void;
}

// A target's range, as core checks it.
const bounds = (target: "targetSets" | "targetReps" | "targetWeight" | "restSeconds") => {
  const { minValue, maxValue } = exerciseEntrySchema.shape[ target ];

  return {
    min: minValue ?? 0,
    max: maxValue ?? Number.MAX_SAFE_INTEGER
  };
};

export const REST_STEP_SECONDS = 15;

export const restStepper = {
  label: "Rest (s)",
  step: REST_STEP_SECONDS,
  ...bounds("restSeconds")
};

interface ExerciseEntryRowProps {
  entry: Entry;
  unit: Unit;
  editing: EntryEditing;
  // Omitted at the top / bottom of the list.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  first?: boolean;
  last?: boolean;
}

// An Exercise Entry in the Plan editor. A long-press opens its sets, reps,
// weight and rest steppers and Remove below it; each change saves straight away.
export function ExerciseEntryRow({
  entry, unit, editing, onMoveUp, onMoveDown, first, last
}: ExerciseEntryRowProps) {
  const open = editing.editingId === entry.id;
  const change = (changes: ExerciseEntryUpdatePayload) => editing.onChange(entry, changes);
  const error = editing.error?.id === entry.id ? editing.error.message : undefined;

  return (
    <View onTouchStart={open ? editing.onTouchInside : undefined}>
      <OrderedRow title={entry.exercise.name}
        subtitle={formatTargets(entry, unit)}
        onLongPress={() => editing.onEdit(entry)}
        accessibilityHint="Long-press to edit"
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        first={first}
        last={last && !open} />
      {open && (
        <View className={`gap-3 px-4 pb-2 pt-3 ${rowSurfaceClass({ last })}`}>
          <View className="flex-row gap-3">
            <Stepper label="Sets"
              value={entry.targetSets}
              step={1}
              {...bounds("targetSets")}
              onChange={targetSets => change({ targetSets })} />
            <Stepper label="Reps"
              value={entry.targetReps}
              step={1}
              {...bounds("targetReps")}
              onChange={targetReps => change({ targetReps })} />
          </View>
          <View className="flex-row gap-3">
            <Stepper label={`Weight (${unit})`}
              value={entry.targetWeight}
              step={entry.weightStep}
              decimal
              {...bounds("targetWeight")}
              onChange={targetWeight => change({ targetWeight })} />
            <Stepper {...restStepper}
              value={entry.restSeconds}
              onChange={restSeconds => change({ restSeconds })} />
          </View>
          {error && <AppText className="text-danger">{error}</AppText>}
          <AppButton variant="destructive"
            className="self-start"
            onPress={() => editing.onRemove(entry)}>
            Remove
          </AppButton>
        </View>
      )}
    </View>
  );
}
