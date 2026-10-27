import { View } from "react-native";

import { AppIcon } from "./AppIcon";
import type { IconName } from "./AppIcon";
import { AppText } from "./AppText";

// What a list or screen shows when there's nothing in it yet, or the thing it
// opened no longer exists.
export function EmptyState({ icon, message }: { icon: IconName; message: string }) {
  return (
    <View className="items-center gap-3 px-6 py-12">
      <AppIcon name={icon}
        color="faint"
        size={40} />
      <AppText className="text-center text-muted">{message}</AppText>
    </View>
  );
}
