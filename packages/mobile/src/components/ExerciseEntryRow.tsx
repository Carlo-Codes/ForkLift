import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS } from "@forklift/core";
import type { ExerciseEntryUpdatePayload } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { errorOn, useEntryList } from "./EntryListContext";
import type { Entry } from "./EntryListContext";
import { ListRow, rowSurfaceClass } from "./ListRow";
import { OrderedRow } from "./OrderedRow";
import { Stepper } from "./Stepper";

import { formatTargets } from "@/format";

interface ExerciseEntryRowProps {
  entry: Entry;
  // Omitted at the top / bottom of the list.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  first?: boolean;
  last?: boolean;
}

// An Exercise Entry in the Plan editor. A long-press opens its sets, reps,
// weight, Weight Step and rest steppers and Remove below it; each change
// saves straight away. In Select mode a tap ticks it instead.
export function ExerciseEntryRow({
  entry, onMoveUp, onMoveDown, first, last
}: ExerciseEntryRowProps) {
  const {
    unit, editing, selecting
  } = useEntryList();

  const open = editing.editingId === entry.id;
  const change = (changes: ExerciseEntryUpdatePayload) => editing.onChange(entry, changes);
  const error = errorOn(editing.error, "entry", entry.id);
  const subtitle = formatTargets(entry, unit);

  if (selecting) {
    return (
      <ListRow title={entry.exercise.name}
        subtitle={subtitle}
        ticked={selecting.ticked.has(entry.id)}
        onPress={() => selecting.onToggle([ entry.id ])}
        first={first}
        last={last} />
    );
  }

  return (
    <View onTouchStart={open ? editing.onTouchInside : undefined}>
      <OrderedRow title={entry.exercise.name}
        subtitle={subtitle}
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
