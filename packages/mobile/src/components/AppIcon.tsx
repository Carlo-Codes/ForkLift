import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import type { ThemeColor } from "@forklift/tailwind-config/colors";

import { useThemeColors } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

interface AppIconProps {
  name: IconName;
  color?: ThemeColor;
  size?: number;
}

// An Ionicons glyph in a theme colour. Icons are decorative: label the button
// around them for screen readers.
export function AppIcon({
  name, color = "ink", size = 22
}: AppIconProps) {
  const colors = useThemeColors();

  return (
    <Ionicons name={name}
      size={size}
      color={colors[ color ]}
      accessibilityElementsHidden
      importantForAccessibility="no" />
  );
}
