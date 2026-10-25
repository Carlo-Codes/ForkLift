import "../src/global.css";

import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { loadBuiltInExercises } from "@forklift/core";

import { AppText } from "@/components/AppText";
import { openDb } from "@/db/client";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ fontsLoaded, fontError ] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold
  });

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
      <View className="flex-1 items-center justify-center bg-brand-white px-6">
        <AppText className="text-center text-brand-error">
          ForkLift couldn&apos;t open its database: {dbError.message}
        </AppText>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#E8590C" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" }
      }}
    >
      <Stack.Screen name="index"
        options={{ title: "ForkLift" }} />
      <Stack.Screen name="settings"
        options={{ title: "Settings" }} />
      <Stack.Screen name="exercises/index"
        options={{ title: "Exercise Library" }} />
      <Stack.Screen name="exercises/new"
        options={{ title: "Add Exercise" }} />
      <Stack.Screen name="exercises/[id]"
        options={{ title: "Exercise" }} />
      <Stack.Screen name="plans/index"
        options={{ title: "Plans" }} />
      <Stack.Screen name="plans/[id]"
        options={{ title: "Plan" }} />
      <Stack.Screen name="workouts/[id]"
        options={{ title: "Workout" }} />
      <Stack.Screen name="workouts/add-exercise"
        options={{ title: "Add Exercise" }} />
      <Stack.Screen name="entries/[id]"
        options={{ title: "Targets" }} />
      <Stack.Screen name="sessions/new"
        options={{ title: "Choose Workout" }} />
      <Stack.Screen name="sessions/[id]"
        options={{ title: "Workout Mode" }} />
      <Stack.Screen name="history/index"
        options={{ title: "History" }} />
      <Stack.Screen name="history/sessions/[id]"
        options={{ title: "Session" }} />
      <Stack.Screen name="history/exercises/[id]"
        options={{ title: "Exercise History" }} />
    </Stack>
  );
}
