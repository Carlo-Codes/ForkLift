import { Tabs } from "expo-router/js-tabs";

import { AppIcon } from "@/components/AppIcon";
import type { IconName } from "@/components/AppIcon";
import { useThemeColors } from "@/theme";

export const unstable_settings = { initialRouteName: "(home)" };

const TABS:{ name: string; title: string; icon: IconName; focusedIcon: IconName }[] = [
  {
    name: "(home)",
    title: "Home",
    icon: "home-outline",
    focusedIcon: "home"
  },
  {
    name: "plans",
    title: "Plans",
    icon: "calendar-outline",
    focusedIcon: "calendar"
  },
  {
    name: "history",
    title: "History",
    icon: "time-outline",
    focusedIcon: "time"
  },
  {
    name: "exercises",
    title: "Library",
    icon: "barbell-outline",
    focusedIcon: "barbell"
  },
  {
    name: "settings",
    title: "Settings",
    icon: "settings-outline",
    focusedIcon: "settings"
  }
];

// The bottom tab bar, inset for the home indicator. Each tab has its own stack
// for its header; Workout Mode and the other screens a tab opens sit on the
// root stack above it, without the tab bar.
export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator
        },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold" },
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // Tinted to match tabBarActiveTintColor and tabBarInactiveTintColor.
            tabBarIcon: ({ focused, size }) => (
              <AppIcon name={focused ? tab.focusedIcon : tab.icon}
                color={focused ? "accent" : "muted"}
                size={size} />
            )
          }} />
      ))}
    </Tabs>
  );
}
