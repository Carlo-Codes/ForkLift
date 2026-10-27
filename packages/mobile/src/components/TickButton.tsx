import { Pressable } from "react-native";

import { AppIcon } from "./AppIcon";

interface TickButtonProps {
  ticked: boolean;
  onPress: () => void;
  // What the tick box ticks, for screen readers when children don't say it.
  accessibilityLabel?: string;
  // Lays out the tick box and children; the touch target is at least 44pt.
  className: string;
  children: React.ReactNode;
}

// A Select mode tick box with what it ticks beside it, e.g. an Exercise Entry
// row or a Superset's header. The whole area toggles it.
export function TickButton({
  ticked, onPress, accessibilityLabel, className, children
}: TickButtonProps) {
  return (
    <Pressable className={`min-h-touch flex-row items-center gap-2 active:opacity-60 ${className}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ticked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}>
      <AppIcon name={ticked ? "checkmark-circle" : "ellipse-outline"}
        color={ticked ? "accent" : "faint"}
        size={24} />
      {children}
    </Pressable>
  );
}
