import { Pressable, View } from "react-native";

import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { Badge } from "./Chip";

interface ListRowProps {
  title: string;
  subtitle?: string;
  badge?: string;
  // Tappable rows show a chevron; omit for a row that only shows information.
  onPress?: () => void;
  // e.g. opening a row's editor in place; a tap then does nothing.
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // Controls after the title, e.g. reorder buttons.
  accessory?: React.ReactNode;
  // Makes the row a tick box (Select mode), ticked or not; onPress toggles it.
  ticked?: boolean;
  // Where the row sits in its group: rows are drawn as one rounded card, with
  // a hairline between them.
  first?: boolean;
  last?: boolean;
}

export const rowPosition = (index: number, count: number) => ({
  first: index === 0,
  last: index === count - 1
});

// The surface of a grouped row, for rows with their own layout.
export const rowSurfaceClass = ({ first, last }: { first?: boolean; last?: boolean }) => [
  "bg-surface",
  first ? "rounded-t-2xl" : "border-t border-separator",
  last && "rounded-b-2xl"
].filter(Boolean).join(" ");

// A Select mode tick box, drawn inside the row or header it ticks.
export function TickBox({ ticked }: { ticked: boolean }) {
  return (
    <AppIcon name={ticked ? "checkmark-circle" : "ellipse-outline"}
      color={ticked ? "accent" : "faint"}
      size={24} />
  );
}

function roleOf(tickBox: boolean, pressable: boolean) {
  if (tickBox) {
    return "checkbox";
  }

  return pressable ? "button" : undefined;
}

// One row in a list, sitting on a Card's surface.
export function ListRow({
  title, subtitle, badge, onPress, onLongPress, accessibilityLabel, accessibilityHint, accessory, ticked, first, last
}: ListRowProps) {
  const pressable = Boolean(onPress ?? onLongPress);
  const tickBox = ticked !== undefined;

  return (
    <View className={`flex-row items-center ${rowSurfaceClass({
      first,
      last
    })}`}>
      <Pressable className="min-h-touch flex-1 flex-row items-center gap-2 py-3 pl-4 pr-2 active:opacity-60"
        disabled={!pressable}
        accessibilityRole={roleOf(tickBox, pressable)}
        accessibilityState={tickBox ? { checked: ticked } : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onLongPress={onLongPress}>
        {tickBox && <TickBox ticked={ticked} />}
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <AppText className="shrink text-base text-ink">{title}</AppText>
            {badge && <Badge>{badge}</Badge>}
          </View>
          {subtitle && <AppText className="text-sm text-muted">{subtitle}</AppText>}
        </View>
        {onPress && !accessory && !tickBox && (
          <AppIcon name="chevron-forward"
            color="faint"
            size={18} />
        )}
      </Pressable>
      {accessory}
    </View>
  );
}
