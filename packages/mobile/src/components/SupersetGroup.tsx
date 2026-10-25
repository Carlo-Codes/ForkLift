import { View } from "react-native";

import type { BlockWithEntries } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { OrderedRow } from "./OrderedRow";

import { formatTargets } from "@/format";

type Entry = BlockWithEntries["exerciseEntries"][number];

interface SupersetGroupProps {
  block: BlockWithEntries;
  unit: Unit;
  onPressEntry: (entry: Entry) => void;
  onMoveEntry: (index: number, delta: -1 | 1) => void;
  onAddEntry: () => void;
  onUngroup: () => void;
  // Move the whole Superset within the Workout; omitted at the top / bottom.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// A Superset in the Workout editor: its entries shown as one group, reordered
// within it, with the group itself moved like any other Block.
export function SupersetGroup({
  block, unit, onPressEntry, onMoveEntry, onAddEntry, onUngroup, onMoveUp, onMoveDown
}: SupersetGroupProps) {
  const entries = block.exerciseEntries;

  return (
    <View className="mx-4 my-2 overflow-hidden rounded-lg border border-brand-primary">
      <View className="flex-row items-center bg-brand-primaryLight">
        <AppText weight="semibold"
          className="flex-1 px-4 py-2 text-brand-primary">
          Superset
        </AppText>
        <AppButton className="px-3 py-2"
          accessibilityLabel="Ungroup superset"
          onPress={onUngroup}>
          <AppText className="text-brand-primary">Ungroup</AppText>
        </AppButton>
        <AppButton className="px-3 py-2 disabled:opacity-30"
          disabled={!onMoveUp}
          accessibilityLabel="Move superset up"
          onPress={onMoveUp}>
          ▲
        </AppButton>
        <AppButton className="px-3 py-2 disabled:opacity-30"
          disabled={!onMoveDown}
          accessibilityLabel="Move superset down"
          onPress={onMoveDown}>
          ▼
        </AppButton>
      </View>
      {entries.map((entry, index) => (
        <OrderedRow
          key={entry.id}
          title={entry.exercise.name}
          subtitle={formatTargets(entry, unit)}
          onPress={() => onPressEntry(entry)}
          onMoveUp={index > 0 ? () => onMoveEntry(index, -1) : undefined}
          onMoveDown={index < entries.length - 1 ? () => onMoveEntry(index, 1) : undefined}
        />
      ))}
      <AppButton className="px-4 py-3"
        onPress={onAddEntry}>
        <AppText className="text-brand-primary">+ Add exercise to superset</AppText>
      </AppButton>
    </View>
  );
}
