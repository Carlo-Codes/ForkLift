import { Pressable } from "react-native";
import type { PressableProps } from "react-native";

import { AppText } from "./AppText";

// Compact: at least the 44pt touch target, no taller.
const SHAPE = "min-h-touch flex-row items-center justify-center gap-2 rounded-xl px-4 active:opacity-70 disabled:opacity-40";

const VARIANT_BASE_CLASS = {
  // The one main action on a screen.
  primary: `${SHAPE} bg-accent`,
  // Any other action: a soft fill rather than an outline.
  secondary: `${SHAPE} bg-fill`,
  // A text-only action, e.g. "Choose a different workout".
  link: SHAPE,
  // A text-only action that deletes or removes.
  destructive: SHAPE,
  // Unstyled: the caller lays out its own content (rows, big tap areas).
  plain: "active:opacity-70 disabled:opacity-40"
} as const;

const VARIANT_TEXT_CLASS = {
  primary: "text-on-accent",
  secondary: "text-accent",
  link: "text-accent",
  destructive: "text-danger",
  plain: "text-ink"
} as const;

type AppButtonVariant = keyof typeof VARIANT_BASE_CLASS;

interface AppButtonProps extends Omit<PressableProps, "children"> {
  variant?: AppButtonVariant;
  children?: React.ReactNode;
}

// React 19 passes `ref` as a regular prop (Link asChild relies on it), so it
// arrives through PressableProps and is spread onto the Pressable.
export function AppButton({
  variant = "plain", className, children, ...props
}: AppButtonProps) {
  return (
    <Pressable
      className={[ VARIANT_BASE_CLASS[ variant ], className ].filter(Boolean).join(" ")}
      {...props}
    >
      {typeof children === "string" ?
        (
          <AppText weight={variant === "plain" ? "regular" : "semibold"}
            className={VARIANT_TEXT_CLASS[ variant ]}>
            {children}
          </AppText>
        ) :
        children}
    </Pressable>
  );
}
