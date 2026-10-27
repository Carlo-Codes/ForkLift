import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS, roundRest } from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { errorOn, useEntryList } from "./EntryListContext";
import { ExerciseEntryRow } from "./ExerciseEntryRow";
import { TickBox } from "./ListRow";
import { MoveButtons } from "./OrderedRow";
import { Stepper } from "./Stepper";

interface SupersetGroupProps {
  block: BlockWithEntries;
  onSetRoundRest: (restSeconds: number) => void;
  onMoveEntry: (index: number, delta: -1 | 1) => void;
  onAddEntry: () => void;
  // Move the whole Superset within the Workout; omitted at the top / bottom.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// A Superset in the Plan editor: its entries shown as one bordered group, reordered
// within it, with the group itself moved like any other Block. The header
// shows the Round Rest; changing it sets the rest of every entry. In Select
// mode the header ticks the whole Superset.
export function SupersetGroup({
  block, onSetRoundRest, onMoveEntry, onAddEntry, onMoveUp, onMoveDown
}: SupersetGroupProps) {
  const { editing, selecting } = useEntryList();
  const entries = block.exerciseEntries;
  const entryIds = entries.map(e => e.id);
  const error = errorOn(editing.error, "superset", block.id);
  const ticked = selecting && entryIds.every(id => selecting.ticked.has(id));

  return (
    <View className="overflow-hidden rounded-2xl border-2 border-accent-soft bg-surface">
      <View className="gap-2 bg-accent-soft pb-3 pl-4">
        <View className="min-h-touch flex-row items-center">
          {selecting ?
            (
              <AppButton className="min-h-touch flex-1 flex-row items-center gap-2"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ticked }}
                accessibilityLabel="Superset"
                onPress={() => selecting.onToggle(entryIds)}>
                <TickBox ticked={Boolean(ticked)} />
                <AppText weight="semibold"
                  className="text-accent">
                  Superset
                </AppText>
              </AppButton>
            ) :
            (
              <>
                <AppText weight="semibold"
                  className="flex-1 text-accent">
                  Superset
                </AppText>
                <MoveButtons label="superset"
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown} />
              </>
            )}
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
          onMoveUp={index > 0 ? () => onMoveEntry(index, -1) : undefined}
          onMoveDown={index < entries.length - 1 ? () => onMoveEntry(index, 1) : undefined} />
      ))}
      {!selecting && (
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
      )}
    </View>
  );
}
