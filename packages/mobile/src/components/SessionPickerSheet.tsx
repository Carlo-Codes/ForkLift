import { useState } from "react";
import {
  Modal, Pressable, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PlanCalendarDay, PlanCalendarSession } from "@forklift/core";

import { AppText } from "./AppText";
import { ListRow, rowPosition } from "./ListRow";

import { formatDate } from "@/format";

// A Plan Calendar day's Sessions to pick from, in a sheet over the bottom of the
// screen so it shows wherever the calendar is scrolled. Tapping outside it, or
// Back on Android, closes it.
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
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close workout list"
          onPress={onClose} />
        <View className="gap-2 rounded-t-2xl bg-background px-4 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
          accessibilityViewIsModal>
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
        </View>
      </View>
    </Modal>
  );
}
