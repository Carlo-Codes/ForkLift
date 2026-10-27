import "../src/global.css";

import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { loadBuiltInExercises } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { Screen } from "@/components/Screen";
import { openDb } from "@/db/client";
import { useStackScreenOptions } from "@/navigation";
import { useThemeColors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// A screen opened by a link still has the tabs under it to go back to.
export const unstable_settings = { initialRouteName: "(tabs)" };

const planEditorOptions = {
  title: "",
  headerLargeTitle: false,
  headerBackTitle: "Plans"
};

const ALL_EDGES = [
  "top",
  "bottom",
  "left",
  "right"
] as const;

export default function RootLayout() {
  const [ fontsLoaded, fontError ] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold
  });

  const colors = useThemeColors();
  const stackScreenOptions = useStackScreenOptions();
  const [ dbReady, setDbReady ] = useState(false);
  const [ dbError, setDbError ] = useState<Error>();

  useEffect(() => {
    try {
      openDb();
      loadBuiltInExercises();
      setDbReady(true);
    } catch (error) {
      setDbError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // The window behind the screens, seen during transitions and behind the
  // keyboard, follows the theme too.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [ colors.background ]);

  // A font that fails to load falls back to the system font rather than
  // keeping the splash screen up forever.
  const fontsSettled = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsSettled && (dbReady || dbError)) {
      void SplashScreen.hideAsync();
    }
  }, [
    fontsSettled,
    dbReady,
    dbError
  ]);

  if (!fontsSettled || (!dbReady && !dbError)) {
    return null;
  }

  if (dbError) {
    return (
      <Screen edges={ALL_EDGES}
        className="items-center justify-center px-6">
        <StatusBar style="auto" />
        <AppText className="text-center text-danger">
          ForkLift couldn&apos;t open its database: {dbError.message}
        </AppText>
      </Screen>
    );
  }

  // Gesture Handler's root, for dragging rows and tabs into a new order.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={stackScreenOptions}>
        {/* Home, Plans, History, Library and Settings, each with its own header. */}
        <Stack.Screen name="(tabs)"
          options={{ headerShown: false }} />
        <Stack.Screen name="ai-changes"
          options={{ title: "Changes by AI" }} />
        <Stack.Screen name="exercises/new"
          options={{ title: "Add Exercise" }} />
        <Stack.Screen name="exercises/[id]"
          options={{ title: "Exercise" }} />
        {/* The Plan editor: its name is the large title, edited in place. */}
        <Stack.Screen name="plans/new"
          options={planEditorOptions} />
        <Stack.Screen name="plans/[id]"
          options={planEditorOptions} />
        <Stack.Screen name="workouts/add-exercise"
          options={{ title: "Add Exercise" }} />
        <Stack.Screen name="sessions/new"
          options={{ title: "Choose Workout" }} />
        {/* Workout Mode: pushed over the tabs, so it fills the screen. */}
        <Stack.Screen name="sessions/[id]"
          options={{
            title: "Workout Mode",
            // The set and the Done button need the room.
            headerLargeTitle: false
          }} />
        <Stack.Screen name="history/sessions/[id]"
          options={{ title: "Session" }} />
        <Stack.Screen name="history/exercises/[id]"
          options={{ title: "Exercise History" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
