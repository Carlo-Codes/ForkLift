import { Link } from "expo-router";
import { View } from "react-native";

import { AppButton } from "@/components/AppButton";

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-end gap-3 bg-brand-white p-6">
      <Link href="/plans"
        asChild>
        <AppButton variant="outline">Plans</AppButton>
      </Link>
      <Link href="/exercises"
        asChild>
        <AppButton variant="outline">Exercise Library</AppButton>
      </Link>
      <Link href="/settings"
        asChild>
        <AppButton variant="outline">Settings</AppButton>
      </Link>
    </View>
  );
}
