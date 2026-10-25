import { Link } from "expo-router";
import { View } from "react-native";

import { AppButton } from "@/components/AppButton";

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-end bg-brand-white p-6">
      <Link href="/settings"
        asChild>
        <AppButton variant="outline">Settings</AppButton>
      </Link>
    </View>
  );
}
