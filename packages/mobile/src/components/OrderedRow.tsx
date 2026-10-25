import { View } from "react-native";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";

interface OrderedRowProps {
  title: string;
  subtitle?: string;
  badge?: string;
  onPress: () => void;
  // Omitted at the top / bottom of the list.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// A row in an ordered list (Plans, Workouts, Blocks) with up/down buttons for
// reordering.
export function OrderedRow({
  title, subtitle, badge, onPress, onMoveUp, onMoveDown
}: OrderedRowProps) {
  return (
    <View className="flex-row items-center border-b border-brand-lighterGray">
      <AppButton className="flex-1 px-4 py-3"
        accessibilityRole="button"
        onPress={onPress}>
        <View className="flex-row items-center gap-2">
          <AppText className="text-brand-darkGray">{title}</AppText>
          {badge && (
            <AppText weight="semibold"
              className="rounded-full bg-brand-primaryLight px-2 text-xs text-brand-primary">
              {badge}
            </AppText>
          )}
        </View>
        {subtitle && <AppText className="text-sm text-brand-mediumGray">{subtitle}</AppText>}
      </AppButton>
      <AppButton className="px-3 py-3 disabled:opacity-30"
        disabled={!onMoveUp}
        accessibilityLabel={`Move ${title} up`}
        onPress={onMoveUp}>
        ▲
      </AppButton>
      <AppButton className="px-3 py-3 disabled:opacity-30"
        disabled={!onMoveDown}
        accessibilityLabel={`Move ${title} down`}
        onPress={onMoveDown}>
        ▼
      </AppButton>
    </View>
  );
}

// The ids in their new order after moving the one at index by delta places.
export function moveId(ids: string[], index: number, delta: -1 | 1): string[] {
  const next = [ ...ids ];
  const [ moved ] = next.splice(index, 1);

  next.splice(index + delta, 0, moved!);

  return next;
}
