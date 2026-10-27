import { useState } from "react";
import { View } from "react-native";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

import { stepValue, toNumber } from "@/format";

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  // Weights take decimals; counts and seconds don't.
  decimal?: boolean;
  // Saved straight away, on each tap of − / + and on each number typed.
  onChange: (value: number) => void;
}

// A number with − and + either side, e.g. a target's sets or rest. The number
// can be typed too: what's typed saves while it's a number in range, and the
// field goes back to the saved value once editing ends.
export function Stepper({
  label, value, step, min, max, decimal, onChange
}: StepperProps) {
  // What the lifter is typing, while they are.
  const [ text, setText ] = useState<string>();

  const type = (typed: string) => {
    setText(typed);

    const number = toNumber(typed);

    if (number >= min && number <= max && (decimal || Number.isInteger(number))) {
      onChange(number);
    }
  };

  return (
    <View className="flex-1 gap-1">
      <AppText className="text-sm text-muted">{label}</AppText>
      <View className="flex-row items-center gap-1">
        <AppButton variant="secondary"
          disabled={value <= min}
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(stepValue(value, -step, min, max))}>
          <AppIcon name="remove"
            color="accent"
            size={20} />
        </AppButton>
        <AppTextInput className="flex-1 text-center"
          value={text ?? String(value)}
          onChangeText={type}
          onEndEditing={() => setText(undefined)}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          accessibilityLabel={label}
          selectTextOnFocus />
        <AppButton variant="secondary"
          disabled={value >= max}
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(stepValue(value, step, min, max))}>
          <AppIcon name="add"
            color="accent"
            size={20} />
        </AppButton>
      </View>
    </View>
  );
}
