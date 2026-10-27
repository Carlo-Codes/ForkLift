import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS, roundRest } from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { errorOn, ExerciseEntryRow } from "./ExerciseEntryRow";
import type { EntryEditing } from "./ExerciseEntryRow";
import { MoveButtons } from "./OrderedRow";
import { Stepper } from "./Stepper";

interface SupersetGroupProps {
  block: BlockWithEntries;
  unit: Unit;
  editing: EntryEditing;
  onSetRoundRest: (restSeconds: number) => void;
  onMoveEntry: (index: number, delta: -1 | 1) => void;
  onAddEntry: () => void;
  onUngroup: () => void;
  // Move the whole Superset within the Workout; omitted at the top / bottom.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// A Superset in the Plan editor: its entries shown as one bordered group, reordered
// within it, with the group itself moved like any other Block. The header
// shows the Round Rest; changing it sets the rest of every entry.
export function SupersetGroup({
  block, unit, editing, onSetRoundRest, onMoveEntry, onAddEntry, onUngroup, onMoveUp, onMoveDown
}: SupersetGroupProps) {
  const entries = block.exerciseEntries;
  const error = errorOn(editing.error, "superset", block.id);

  return (
    <View className="overflow-hidden rounded-2xl border-2 border-accent-soft bg-surface">
      <View className="gap-2 bg-accent-soft pb-3 pl-4">
        <View className="flex-row items-center">
          <AppText weight="semibold"
            className="flex-1 text-accent">
            Superset
          </AppText>
          <AppButton variant="link"
            accessibilityLabel="Ungroup superset"
            onPress={onUngroup}>
            Ungroup
          </AppButton>
          <MoveButtons label="superset"
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown} />
        </View>
        <View className="flex-row pr-4">
          <Stepper label="Round Rest (s)"
            value={roundRest(entries)!}
            {...EXERCISE_ENTRY_BOUNDS.restSeconds}
            onChange={onSetRoundRest} />
        </View>
        {error && <AppText className="text-danger">{error}</AppText>}
      </View>
      {entries.map((entry, index) => (
        <ExerciseEntryRow key={entry.id}
          entry={entry}
          unit={unit}
          editing={editing}
          onMoveUp={index > 0 ? () => onMoveEntry(index, -1) : undefined}
          onMoveDown={index < entries.length - 1 ? () => onMoveEntry(index, 1) : undefined} />
      ))}
      <AppButton className="min-h-touch flex-row items-center gap-2 border-t border-separator px-4"
        onPress={onAddEntry}>
        <AppIcon name="add"
          color="accent"
          size={20} />
        <AppText weight="semibold"
          className="text-accent">
          Add exercise to superset
        </AppText>
      </AppButton>
    </View>
  );
}
