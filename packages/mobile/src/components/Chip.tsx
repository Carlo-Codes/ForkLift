import { Pressable } from "react-native";
import type { PressableProps } from "react-native";

import { AppText } from "./AppText";

interface ChipProps extends Omit<PressableProps, "children"> {
  selected?: boolean;
  children: string;
}

// A pill that toggles one option on or off, e.g. a muscle group or the unit.
export function Chip({
  selected, className, children, ...props
}: ChipProps) {
  return (
    <Pressable
      className={[
        "min-h-touch items-center justify-center rounded-full px-4 active:opacity-70",
        selected ? "bg-accent-soft" : "bg-fill",
        className
      ].filter(Boolean).join(" ")}
      {...props}
    >
      <AppText weight={selected ? "semibold" : "regular"}
        className={selected ? "text-accent" : "text-ink"}>
        {children}
      </AppText>
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
