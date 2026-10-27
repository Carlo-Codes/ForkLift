import { View } from "react-native";

import type { BlockWithEntries } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { ExerciseEntryRow } from "./ExerciseEntryRow";
import type { EntryEditing } from "./ExerciseEntryRow";
import { SupersetGroup } from "./SupersetGroup";

interface BlockItemProps {
  block: BlockWithEntries;
  unit: Unit;
  editing: EntryEditing;
  onSetRoundRest: (restSeconds: number) => void;
  onMoveEntry: (index: number, delta: -1 | 1) => void;
  onAddToSuperset: () => void;
  onUngroup: () => void;
  // Omitted for the last Block.
  onSupersetWithNext?: () => void;
  // Omitted at the top / bottom of the Workout.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// One Block of the selected Workout in the Plan editor: a single Exercise
// Entry as a row, or a Superset as a bordered group. Reordering (8/9) and
// Select mode (7/9) replace the buttons here.
export function BlockItem({
  block, unit, editing, onSetRoundRest, onMoveEntry, onAddToSuperset, onUngroup, onSupersetWithNext, onMoveUp, onMoveDown
}: BlockItemProps) {
  const [ entry, ...others ] = block.exerciseEntries;

  if (!entry) {
    return null;
  }

  return (
    <View>
      {others.length > 0 ?
        (
          <SupersetGroup
            block={block}
            unit={unit}
            editing={editing}
            onSetRoundRest={onSetRoundRest}
            onMoveEntry={onMoveEntry}
            onAddEntry={onAddToSuperset}
            onUngroup={onUngroup}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) :
        (
          <ExerciseEntryRow entry={entry}
            unit={unit}
            editing={editing}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            first
            last />
        )}
      {onSupersetWithNext && (
        <AppButton className="min-h-touch flex-row items-center justify-center gap-1"
          accessibilityLabel="Superset with the next exercise"
          onPress={onSupersetWithNext}>
          <AppIcon name="link"
            color="accent"
            size={16} />
          <AppText className="text-sm text-accent">Superset with next</AppText>
        </AppButton>
      )}
    </View>
  );
}
