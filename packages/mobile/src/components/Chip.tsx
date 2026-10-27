import { Pressable } from "react-native";
import type { PressableProps } from "react-native";

import { AppIcon } from "./AppIcon";
import type { IconName } from "./AppIcon";
import { AppText } from "./AppText";

interface ChipProps extends Omit<PressableProps, "children"> {
  selected?: boolean;
  // Drawn before the label; an icon-only chip needs an accessibilityLabel.
  icon?: IconName;
  children?: string;
  // Adds a "×" at the end that clears what the chip holds, e.g. a Plan date.
  onClear?: () => void;
  clearLabel?: string;
}

// A pill that toggles or picks one option, e.g. a muscle group, the unit, a
// Workout tab or a Plan date.
export function Chip({
  selected, icon, className, children, onClear, clearLabel, ...props
}: ChipProps) {
  const color = selected ? "accent" : "ink";
  // The pill's own padding: less beside a lone icon, none before the "×",
  // which brings its own touch target.
  const startPadding = children ? "pl-4" : "pl-3";
  const endPadding = children ? "pr-4" : "pr-3";
  const iconColor = selected || !children ? "accent" : "muted";

  return (
    <Pressable
      className={[
        "min-h-touch flex-row items-center justify-center gap-2 rounded-full active:opacity-70",
        startPadding,
        !onClear && endPadding,
        selected ? "bg-accent-soft" : "bg-fill",
        className
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {icon && (
        <AppIcon name={icon}
          color={iconColor}
          size={children ? 16 : 22} />
      )}
      {children && (
        <AppText weight={selected ? "semibold" : "regular"}
          className={selected ? "text-accent" : "text-ink"}>
          {children}
        </AppText>
      )}
      {onClear && (
        <Pressable className="min-h-touch min-w-touch items-center justify-center active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={onClear}>
          <AppIcon name="close"
            color={color}
            size={18} />
        </Pressable>
      )}
    </Pressable>
  );
}

// A small label that isn't tappable, e.g. "Active" next to a Plan's name. A
// muted one is grey, for a state that's past rather than current ("Ended").
export function Badge({ muted, children }: { muted?: boolean; children: string }) {
  return (
    <AppText weight="semibold"
      className={`overflow-hidden rounded-full px-2 py-0.5 text-xs ${muted ? "bg-fill text-muted" : "bg-accent-soft text-accent"}`}>
      {children}
    </AppText>
  );
}
