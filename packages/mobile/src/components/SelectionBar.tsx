import { View } from "react-native";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { Card } from "./Card";

interface SelectionBarProps {
  count: number;
  // Whether a ticked row is part of a Superset.
  canUngroup: boolean;
  onCreateSuperset: () => void;
  onUngroup: () => void;
  onRemove: () => void;
}

// Select mode's actions on the ticked rows, at the bottom of the Plan editor.
// Place it last in a Screen, over the content.
export function SelectionBar({
  count, canUngroup, onCreateSuperset, onUngroup, onRemove
}: SelectionBarProps) {
  return (
    <Card className="absolute bottom-4 left-4 right-4 gap-1 border border-separator px-2 py-2">
      <AppText className="px-2 text-sm text-muted"
        accessibilityLiveRegion="polite">
        {count === 0 ? "Tick exercises" : `${count} ticked`}
      </AppText>
      <View className="flex-row flex-wrap">
        <AppButton variant="link"
          disabled={count < 2}
          onPress={onCreateSuperset}>
          Create Superset
        </AppButton>
        <AppButton variant="link"
          disabled={!canUngroup}
          onPress={onUngroup}>
          Ungroup
        </AppButton>
        <View className="flex-1" />
        <AppButton variant="destructive"
          disabled={count === 0}
          onPress={onRemove}>
          Remove
        </AppButton>
      </View>
    </Card>
  );
}
