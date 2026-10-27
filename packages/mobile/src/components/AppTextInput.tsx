import type { Ref } from "react";
import { TextInput } from "react-native";
import type { TextInputInstance, TextInputProps } from "react-native";

import { useThemeColors } from "@/theme";

const VARIANT_CLASS = {
  // A text field on a soft fill.
  filled: "min-h-touch rounded-xl bg-fill px-3 py-2 font-Inter_Regular",
  // No fill, padding or font of its own, e.g. a title edited in place: the
  // caller sets them. Classes that clash don't override by their order in
  // className, so they're left out here rather than overridden.
  plain: ""
} as const;

interface AppTextInputProps extends TextInputProps {
  variant?: keyof typeof VARIANT_CLASS;
  // e.g. to focus the field once it's shown (jsx-a11y bans autoFocus).
  ref?: Ref<TextInputInstance>;
}

// A themed text field. Callers add size and alignment, not colours.
export function AppTextInput({
  variant = "filled", className, ...props
}: AppTextInputProps) {
  const colors = useThemeColors();

  return (
    <TextInput
      className={[
        VARIANT_CLASS[ variant ],
        "text-ink",
        className
      ].filter(Boolean).join(" ")}
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...props}
    />
  );
}
