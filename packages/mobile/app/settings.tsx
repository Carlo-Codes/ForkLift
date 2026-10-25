import { useState } from "react";
import { View } from "react-native";

import { getSettings, setUnit } from "@forklift/core";
import { unitValues } from "@forklift/db/client";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";

export default function SettingsScreen() {
  const [ unit, setUnitState ] = useState<Unit>(() => getSettings().unit);
  const [ error, setError ] = useState<string>();

  const chooseUnit = (next: Unit) => {
    try {
      setUnitState(setUnit(next).unit);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="flex-1 gap-3 bg-brand-white p-6">
      <AppText weight="semibold"
        className="text-lg text-brand-darkGray">
        Weight unit
      </AppText>
      <View className="flex-row gap-3"
        accessibilityRole="radiogroup">
        {unitValues.map(value => (
          <AppButton
            key={value}
            variant="chip"
            selected={value === unit}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === unit }}
            onPress={() => chooseUnit(value)}
          >
            {value}
          </AppButton>
        ))}
      </View>
      <AppText className="text-brand-mediumGray">
        Every weight in ForkLift uses this unit.
      </AppText>
      {error && <AppText className="text-brand-error">{error}</AppText>}
    </View>
  );
}
