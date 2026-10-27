import { Pressable, View } from "react-native";

import { AppIcon } from "./AppIcon";
import { ListRow } from "./ListRow";

interface OrderedRowProps {
  title: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  // Omitted at the top / bottom of the list.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  first?: boolean;
  last?: boolean;
}

export function MoveButtons({
  label, onMoveUp, onMoveDown
}: { label: string; onMoveUp?: () => void; onMoveDown?: () => void }) {
  return (
    <View className="flex-row pr-1">
      <Pressable className="min-h-touch min-w-touch items-center justify-center active:opacity-60 disabled:opacity-30"
        disabled={!onMoveUp}
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} up`}
        onPress={onMoveUp}>
        <AppIcon name="chevron-up"
          color="muted"
          size={20} />
      </Pressable>
      <Pressable className="min-h-touch min-w-touch items-center justify-center active:opacity-60 disabled:opacity-30"
        disabled={!onMoveDown}
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} down`}
        onPress={onMoveDown}>
        <AppIcon name="chevron-down"
          color="muted"
          size={20} />
      </Pressable>
    </View>
  );
}

// A row in an ordered list (Plans, Workouts, Blocks) with up/down buttons for
// reordering.
export function OrderedRow({
  title, subtitle, badge, onPress, onLongPress, accessibilityHint, onMoveUp, onMoveDown, first, last
}: OrderedRowProps) {
  return (
    <ListRow title={title}
      subtitle={subtitle}
      badge={badge}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={accessibilityHint}
      first={first}
      last={last}
      accessory={(
        <MoveButtons label={title}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown} />
      )} />
  );
}

// The ids in their new order after moving the one at index by delta places.
export function moveId(ids: string[], index: number, delta: -1 | 1): string[] {
  const next = [ ...ids ];
  const [ moved ] = next.splice(index, 1);

  next.splice(index + delta, 0, moved!);

  return next;
}
