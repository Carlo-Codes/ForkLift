import "../src/global.css";

import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View } from "react-native";

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
    </Stack>
  );
}
