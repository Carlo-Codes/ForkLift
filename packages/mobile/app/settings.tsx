import { useState } from "react";
import { Alert, View } from "react-native";

import {
  getSettings, importBackup, setUnit
} from "@forklift/core";
import { unitValues } from "@forklift/db/client";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { pickBackupText, shareBackup } from "@/backupFile";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const [ unit, setUnitState ] = useState<Unit>(() => getSettings().unit);
  const [ error, setError ] = useState<string>();
  const [ backupMessage, setBackupMessage ] = useState<{ text: string; isError: boolean }>();

  const chooseUnit = (next: Unit) => {
    try {
      setUnitState(setUnit(next).unit);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const exportData = () => {
    setBackupMessage(undefined);

    shareBackup().catch((e: unknown) => setBackupMessage({
      text: errorMessage(e),
      isError: true
    }));
  };

  const restore = (text: string) => {
    try {
      importBackup(text);
      setUnitState(getSettings().unit);

      setBackupMessage({
        text: "Backup restored.",
        isError: false
      });
    } catch (e) {
      setBackupMessage({
        text: errorMessage(e),
        isError: true
      });
    }
  };

  // Nothing is replaced until the lifter confirms.
  const importData = async () => {
    setBackupMessage(undefined);

    let text: string | undefined;

    try {
      text = await pickBackupText();
    } catch (e) {
      setBackupMessage({
        text: errorMessage(e),
        isError: true
      });

      return;
    }

    if (text === undefined) {
      return;
    }

    const backup = text;

    Alert.alert(
      "Replace all your data?",
      "Everything in ForkLift now, including Plans, history and Settings, is replaced by this backup. This can't be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Replace",
          style: "destructive",
          onPress: () => restore(backup)
        }
      ]
    );
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
      <AppText weight="semibold"
        className="mt-6 text-lg text-brand-darkGray">
        Backup
      </AppText>
      <AppText className="text-brand-mediumGray">
        Export saves all your data to one file you can keep anywhere. Import restores a file,
        replacing what&apos;s here, for example on a new phone.
      </AppText>
      <View className="flex-row gap-3">
        <AppButton variant="outline"
          className="py-2"
          onPress={exportData}>
          Export
        </AppButton>
        <AppButton variant="outline"
          className="py-2"
          onPress={() => void importData()}>
          Import
        </AppButton>
      </View>
      {backupMessage && (
        <AppText className={backupMessage.isError ? "text-brand-error" : "text-brand-mediumGray"}>
          {backupMessage.text}
        </AppText>
      )}
    </View>
  );
}
