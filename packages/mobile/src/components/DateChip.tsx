import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Modal, Platform, Pressable
} from "react-native";

import { fromCalendarDay, toCalendarDay } from "@forklift/core";

import { AppButton } from "./AppButton";
import { Chip } from "./Chip";

import { formatCalendarDay } from "@/format";
import { useThemeColors } from "@/theme";

type DateLabel = "Start" | "Starts";

interface DateChipProps {
  label: DateLabel;
  // A YYYY-MM-DD calendar day, or null when unset.
  day: string | null;
  // The day the picker opens on while unset, e.g. the other date or today.
  fallback: string;
  // A required date, such as a new Plan's start date, can't be cleared.
  required?: boolean;
  // What the chip says while unset, e.g. "Set start date"; the label otherwise.
  placeholder?: string;
  onChange: (day: string | null) => void;
}

// iOS has no picker dialog, so its inline calendar sits on a card over the
// screen; picking a day closes it.
function IosPicker({
  value, onPick, onClose
}: { value: Date; onPick: (date: Date) => void; onClose: () => void }) {
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
          accessibilityLabel="Start date">
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
// it unless it's required (ADR-0006: dates are calendar days, so only the day
// is kept).
export function DateChip({
  label, day, fallback, required = false, placeholder, onChange
}: DateChipProps) {
  const [ picking, setPicking ] = useState(false);
  const value = fromCalendarDay(day ?? fallback);

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
    <>
      <Chip selected={!!day}
        icon="calendar-outline"
        accessibilityRole="button"
        accessibilityLabel={day ? `${label} ${formatCalendarDay(day)}, change` : (placeholder ?? "Set start date")}
        onPress={open}
        onClear={day && !required ? () => onChange(null) : undefined}
        clearLabel="Clear start date">
        {day ? `${label} ${formatCalendarDay(day)}` : (placeholder ?? label)}
      </Chip>
      {picking && (
        <IosPicker value={value}
          onPick={date => {
            setPicking(false);
            onChange(toCalendarDay(date));
          }}
          onClose={() => setPicking(false)} />
      )}
    </>
  );
}
