import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Modal, Platform, Pressable, View
} from "react-native";

import { fromCalendarDay, toCalendarDay } from "@forklift/core";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";

import { formatCalendarDay } from "@/format";
import { useThemeColors } from "@/theme";

interface DateChipProps {
  // "From" or "To".
  label: string;
  // A YYYY-MM-DD calendar day, or null when unset.
  day: string | null;
  // The day the picker opens on while unset, e.g. the other date or today.
  fallback: string;
  onChange: (day: string | null) => void;
}

// iOS has no picker dialog, so its inline calendar sits on a card over the
// screen; picking a day closes it.
function IosPicker({
  label, value, onPick, onClose
}: { label: string; value: Date; onPick: (date: Date) => void; onClose: () => void }) {
  const colors = useThemeColors();

  return (
    <Modal transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 p-4"
        accessibilityLabel="Close date picker"
        onPress={onClose}>
        {/* A press on the card itself doesn't reach the backdrop. */}
        <Pressable className="w-full rounded-2xl bg-surface p-2"
          accessibilityLabel={`${label} date`}>
          <DateTimePicker value={value}
            mode="date"
            display="inline"
            accentColor={colors.accent}
            onValueChange={(_, date) => onPick(date)} />
          <AppButton variant="link"
            onPress={onClose}>
            Done
          </AppButton>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// A Plan date as a chip: tap to pick a day with the native picker, "×" to clear
// it (ADR-0006: dates are calendar days, so only the day is kept).
export function DateChip({
  label, day, fallback, onChange
}: DateChipProps) {
  const [ picking, setPicking ] = useState(false);
  const value = fromCalendarDay(day ?? fallback);

  const pick = (date: Date) => {
    setPicking(false);
    onChange(toCalendarDay(date));
  };

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        onValueChange: (_, date) => onChange(toCalendarDay(date))
      });
    } else {
      setPicking(true);
    }
  };

  return (
    <View className={`min-h-touch flex-row items-center rounded-full ${day ? "bg-accent-soft" : "bg-fill"}`}>
      <Pressable className="min-h-touch flex-row items-center gap-2 pl-4 pr-3 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={day ? `${label} ${formatCalendarDay(day)}, change` : `Set ${label} date`}
        onPress={open}>
        <AppIcon name="calendar-outline"
          color={day ? "accent" : "muted"}
          size={16} />
        <AppText weight={day ? "semibold" : "regular"}
          className={day ? "text-accent" : "text-ink"}>
          {day ? `${label} ${formatCalendarDay(day)}` : label}
        </AppText>
      </Pressable>
      {day && (
        <Pressable className="min-h-touch min-w-touch items-center justify-center active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label} date`}
          onPress={() => onChange(null)}>
          <AppIcon name="close"
            color="accent"
            size={18} />
        </Pressable>
      )}
      {picking && (
        <IosPicker label={label}
          value={value}
          onPick={pick}
          onClose={() => setPicking(false)} />
      )}
    </View>
  );
}
