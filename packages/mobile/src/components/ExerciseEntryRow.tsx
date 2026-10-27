import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS } from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import type { ExerciseEntryUpdatePayload, Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { rowSurfaceClass } from "./ListRow";
import { OrderedRow } from "./OrderedRow";
import { Stepper } from "./Stepper";

import { formatTargets } from "@/format";

export type Entry = BlockWithEntries["exerciseEntries"][number];

// What an edit that failed was on: an Exercise Entry, or a Superset's Round Rest.
export interface EditError {
  kind: "entry" | "superset";
  id: string;
  message: string;
}

// How the Plan editor edits Exercise Entries in place: one row's editor is
// open at a time, opened by a long-press.
export interface EntryEditing {
  editingId: string | undefined;
  // The last edit that failed.
  error: EditError | undefined;
  onEdit: (entry: Entry) => void;
  onChange: (entry: Entry, changes: ExerciseEntryUpdatePayload) => void;
  onRemove: (entry: Entry) => void;
  // A touch on the open editor, which shouldn't close it.
  onTouchInside: () => void;
}

// The message of an edit that failed on this Exercise Entry or Superset.
export const errorOn = (error: EditError | undefined, kind: EditError["kind"], id: string) => (error?.kind === kind && error.id === id ? error.message : undefined);

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
// weight, Weight Step and rest steppers and Remove below it; each change
// saves straight away.
export function ExerciseEntryRow({
  entry, unit, editing, onMoveUp, onMoveDown, first, last
}: ExerciseEntryRowProps) {
  const open = editing.editingId === entry.id;
  const change = (changes: ExerciseEntryUpdatePayload) => editing.onChange(entry, changes);
  const error = errorOn(editing.error, "entry", entry.id);

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
              {...EXERCISE_ENTRY_BOUNDS.targetSets}
              onChange={targetSets => change({ targetSets })} />
            <Stepper label="Reps"
              value={entry.targetReps}
              {...EXERCISE_ENTRY_BOUNDS.targetReps}
              onChange={targetReps => change({ targetReps })} />
          </View>
          <View className="flex-row gap-3">
            <Stepper label={`Weight (${unit})`}
              value={entry.targetWeight}
              step={entry.weightStep}
              decimal
              {...EXERCISE_ENTRY_BOUNDS.targetWeight}
              onChange={targetWeight => change({ targetWeight })} />
            <Stepper label={`Weight Step (${unit})`}
              value={entry.weightStep}
              decimal
              {...EXERCISE_ENTRY_BOUNDS.weightStep}
              onChange={weightStep => change({ weightStep })} />
          </View>
          <View className="flex-row gap-3">
            <Stepper label="Rest (s)"
              value={entry.restSeconds}
              {...EXERCISE_ENTRY_BOUNDS.restSeconds}
              onChange={restSeconds => change({ restSeconds })} />
            <View className="flex-1" />
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
