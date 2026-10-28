import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS } from "@forklift/core";
import type { ExerciseEntryUpdatePayload } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import {
  DragArea, DragHandle, useDragActions
} from "./DragList";
import { errorOn, useEntryList } from "./EntryListContext";
import type { Entry } from "./EntryListContext";
import { ListRow, rowSurfaceClass } from "./ListRow";
import { Stepper } from "./Stepper";

import { formatTargets } from "@/format";

interface ExerciseEntryRowProps {
  entry: Entry;
  first?: boolean;
  last?: boolean;
}

// An Exercise Entry in the Plan editor, an item of a DragList. A tap opens its
// sets, reps, weight, Weight Step and rest steppers and Remove below it (and
// closes them again); each change saves straight away. Held, it lifts to drag
// (its Block, or the entry within its Superset); its handle is part of the
// row, so a tap on it is a tap on the row.
// In Select mode a tap ticks it instead, and it has no handle.
export function ExerciseEntryRow({
  entry, first, last
}: ExerciseEntryRowProps) {
  const {
    unit, editing, selecting
  } = useEntryList();

  const drag = useDragActions();
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
    <View onTouchStart={editing.onTouchInside}>
      <DragArea>
        <ListRow title={entry.exercise.name}
          subtitle={subtitle}
          onPress={() => editing.onTap(entry)}
          accessibilityHint={open ? "Tap to close, hold to drag" : "Tap to edit, hold to drag"}
          accessibilityActions={drag?.actions}
          onAccessibilityAction={drag?.onAction}
          first={first}
          last={last && !open}
          accessory={<DragHandle />} />
      </DragArea>
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
