import { TextInput } from "react-native";
import type { TextInputProps } from "react-native";

import { useThemeColors } from "@/theme";

// A text field on a soft fill. Callers add size and alignment, not colours.
export function AppTextInput({ className, ...props }: TextInputProps) {
  const colors = useThemeColors();

  return (
    <TextInput
      className={`min-h-touch rounded-xl bg-fill px-3 py-2 font-Inter_Regular text-ink${className ? ` ${className}` : ""}`}
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...props}
    />
  );
}
