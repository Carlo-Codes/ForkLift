import { View } from "react-native";

import type { BlockWithEntries } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { MoveButtons, OrderedRow } from "./OrderedRow";

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

// A Superset in the Plan editor: its entries shown as one bordered group, reordered
// within it, with the group itself moved like any other Block.
export function SupersetGroup({
  block, unit, onPressEntry, onMoveEntry, onAddEntry, onUngroup, onMoveUp, onMoveDown
}: SupersetGroupProps) {
  const entries = block.exerciseEntries;

  return (
    <View className="overflow-hidden rounded-2xl border-2 border-accent-soft bg-surface">
      <View className="flex-row items-center bg-accent-soft pl-4">
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
