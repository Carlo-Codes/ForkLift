import { View } from "react-native";

import { EXERCISE_ENTRY_BOUNDS, roundRest } from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { DragHandle, DragList } from "./DragList";
import { errorOn, useEntryList } from "./EntryListContext";
import { ExerciseEntryRow } from "./ExerciseEntryRow";
import { Stepper } from "./Stepper";
import { TickButton } from "./TickButton";

interface SupersetGroupProps {
  block: BlockWithEntries;
  onSetRoundRest: (restSeconds: number) => void;
  // The entry ids in their new order.
  onReorderEntries: (exerciseEntryIds: string[]) => void;
  onAddEntry: () => void;
}

// A Superset in the Plan editor: its entries shown as one bordered group and
// dragged into a new order within it, while the header's handle drags the
// whole group like any other Block. The header shows the Round Rest; changing
// it sets the rest of every entry. In Select mode the header ticks the whole
// Superset.
export function SupersetGroup({
  block, onSetRoundRest, onReorderEntries, onAddEntry
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
              <TickButton className="flex-1"
                ticked={Boolean(ticked)}
                onPress={() => selecting.onToggle(entryIds)}>
                <AppText weight="semibold"
                  className="text-accent">
                  Superset
                </AppText>
              </TickButton>
            ) :
            (
              <>
                <AppText weight="semibold"
                  className="flex-1 text-accent">
                  Superset
                </AppText>
                <DragHandle label="Superset" />
              </>
            )}
        </View>
        <View className="flex-row pr-4">
          <Stepper label="Round Rest (s)"
            value={roundRest(entries)!}
            {...EXERCISE_ENTRY_BOUNDS.restSeconds}
            disabled={Boolean(selecting)}
            onChange={onSetRoundRest} />
        </View>
        {error && <AppText className="text-danger">{error}</AppText>}
      </View>
      <DragList data={entries}
        keyOf={entry => entry.id}
        enabled={!selecting}
        onReorder={onReorderEntries}
        renderItem={entry => <ExerciseEntryRow entry={entry} />} />
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
