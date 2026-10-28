import { useState } from "react";
import {
  Modal, Pressable, View
} from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PlanCalendarDay, PlanCalendarSession } from "@forklift/core";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { ListRow, rowPosition } from "./ListRow";

import { formatDate } from "@/format";

// A Plan Calendar day's Sessions to pick from, in a sheet over the bottom of the
// screen so it shows wherever the calendar is scrolled. Tapping outside it, its
// Close button, Back on Android or the VoiceOver escape gesture closes it. The
// dim backdrop fades in while only the sheet slides up.
export function SessionPickerSheet({
  day, onPick, onClose
}: {
  // The day with several Sessions, or undefined while the sheet is closed.
  day: PlanCalendarDay | undefined;
  onPick: (session: PlanCalendarSession) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // The last day shown, so the sheet keeps its rows while it slides away.
  const [ shown, setShown ] = useState(day);

  if (day && day !== shown) {
    setShown(day);
  }

  const sessions = (day ?? shown)?.sessions ?? [];

  return (
    <Modal visible={day !== undefined}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close workout list"
          onPress={onClose} />
        {/* The Modal already keeps screen-reader focus off the screen behind,
            so the sheet isn't accessibilityViewIsModal: that would hide the
            backdrop's close button from VoiceOver. */}
        <Animated.View entering={SlideInDown}
          className="gap-2 rounded-t-2xl bg-background px-4 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
          onAccessibilityEscape={onClose}>
          {sessions[ 0 ] && (
            <AppText weight="semibold"
              className="text-ink">
              {formatDate(sessions[ 0 ].startedAt)}
            </AppText>
          )}
          <View>
            {sessions.map((session, i) => (
              <ListRow key={session.id}
                title={session.workoutName}
                subtitle={session.startedAt.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
                onPress={() => onPick(session)}
                {...rowPosition(i, sessions.length)} />
            ))}
          </View>
          <AppButton variant="link"
            accessibilityRole="button"
            accessibilityLabel="Close workout list"
            onPress={onClose}>
            Close
          </AppButton>
        </Animated.View>
      </View>
    </Modal>
  );
}
