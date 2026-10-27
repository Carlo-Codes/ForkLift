import { useColorScheme } from "react-native";

import { themeColors } from "@forklift/tailwind-config/colors";

// The theme's colours as values, for the few styles that can't take a class:
// the native header, icons and Switch tracks. Follows the system setting, like
// the Tailwind tokens do.
export function useThemeColors() {
  return themeColors[ useColorScheme() === "dark" ? "dark" : "light" ];
}
