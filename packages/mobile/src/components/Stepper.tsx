import {
  useEffect, useRef, useState
} from "react";
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
  // Shows the value without letting it change, e.g. in Select mode.
  disabled?: boolean;
  // Saved straight away on each tap of − / +, and once typing ends.
  onChange: (value: number) => void;
}

// A number with − and + either side, e.g. a target's sets or rest. The number
// can be typed too: it saves when editing ends, or when the Stepper goes (the
// editor closing), and a field left empty goes back to the saved value. Core
// checks what's typed, so an out-of-range number shows its error.
export function Stepper({
  label, value, step, min, max, decimal, disabled = false, onChange
}: StepperProps) {
  // What the lifter is typing, while they are.
  const [ text, setText ] = useState<string>();
  // The same, for saving it as the Stepper unmounts.
  const typed = useRef<string>(undefined);
  const save = useRef(onChange);

  save.current = onChange;

  const commit = () => {
    const number = typed.current === undefined ? Number.NaN : toNumber(typed.current);

    typed.current = undefined;
    setText(undefined);

    if (!Number.isNaN(number) && number !== value) {
      save.current(number);
    }
  };

  // Typing ends without editing ending when a tap elsewhere closes the editor.
  useEffect(() => () => {
    const number = typed.current === undefined ? Number.NaN : toNumber(typed.current);

    if (!Number.isNaN(number)) {
      save.current(number);
    }
  }, []);

  const stepBy = (delta: number) => {
    typed.current = undefined;
    setText(undefined);
    onChange(stepValue(value, delta, min, max));
  };

  return (
    <View className="flex-1 gap-1">
      <AppText className="text-sm text-muted">{label}</AppText>
      <View className="flex-row items-center gap-1">
        <AppButton variant="secondary"
          disabled={disabled || value <= min}
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => stepBy(-step)}>
          <AppIcon name="remove"
            color="accent"
            size={20} />
        </AppButton>
        <AppTextInput className="flex-1 text-center"
          value={text ?? String(value)}
          onChangeText={next => {
            typed.current = next;
            setText(next);
          }}
          onEndEditing={commit}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          accessibilityLabel={label}
          editable={!disabled}
          selectTextOnFocus />
        <AppButton variant="secondary"
          disabled={disabled || value >= max}
          accessibilityLabel={`Increase ${label}`}
          onPress={() => stepBy(step)}>
          <AppIcon name="add"
            color="accent"
            size={20} />
        </AppButton>
      </View>
    </View>
  );
}
