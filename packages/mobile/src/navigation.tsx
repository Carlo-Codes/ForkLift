import { Stack } from "expo-router";
import type { ComponentProps } from "react";
import { Platform } from "react-native";

import { useThemeColors } from "@/theme";

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

// The native header every stack shares: large titles on the screen's own
// background, with no orange bar. iOS collapses them as the content scrolls;
// Android's native header has no large title, so its title is set bigger and
// bolder instead.
export function useStackScreenOptions(): StackScreenOptions {
  const colors = useThemeColors();

  return {
    headerLargeTitle: true,
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: Platform.OS === "android" ?
      {
        fontFamily: "Inter_700Bold",
        fontSize: 26,
        color: colors.ink
      } :
      {
        fontFamily: "Inter_600SemiBold",
        color: colors.ink
      },
    headerLargeTitleStyle: {
      fontFamily: "Inter_700Bold",
      color: colors.ink
    },
    contentStyle: { backgroundColor: colors.background }
  };
}

// A tab's own stack, holding just its root screen so it gets the large-title
// header. Screens opened from a tab are pushed on the root stack, over the tab
// bar.
export function TabStack({ title }: { title: string }) {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index"
        options={{ title }} />
    </Stack>
  );
}
