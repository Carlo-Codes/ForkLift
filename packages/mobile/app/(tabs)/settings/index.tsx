import { useState } from "react";
import {
  Alert, ScrollView, View
} from "react-native";

import {
  getSettings, importBackup, setUnit
} from "@forklift/core";
import { unitValues } from "@forklift/db/client";
import type { Unit } from "@forklift/db/client";

import { AiAccessSettings } from "@/components/AiAccessSettings";
import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { pickBackupText, shareBackup } from "@/backupFile";
import { errorMessage } from "@/errorMessage";

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
      "Everything in ForkLift now, including Plans, history, Settings and any workout in progress, is replaced by this backup. This can't be undone.",
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
    <Screen>
      <ScrollView contentContainerClassName="gap-3 p-6">
        <AppText weight="semibold"
          className="text-lg text-ink">
          Weight unit
        </AppText>
        <View className="flex-row gap-3"
          accessibilityRole="radiogroup">
          {unitValues.map(value => (
            <Chip
              key={value}
              selected={value === unit}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === unit }}
              onPress={() => chooseUnit(value)}
          >
              {value}
            </Chip>
          ))}
        </View>
        <AppText className="text-muted">
          Every weight in ForkLift uses this unit.
        </AppText>
        {error && <AppText className="text-danger">{error}</AppText>}
        <AppText weight="semibold"
          className="mt-6 text-lg text-ink">
          Backup
        </AppText>
        <AppText className="text-muted">
          Export saves all your data to one file you can keep anywhere. Import restores a file,
          replacing what&apos;s here, for example on a new phone.
        </AppText>
        <View className="flex-row gap-3">
          <AppButton variant="secondary"
            onPress={exportData}>
            Export
          </AppButton>
          <AppButton variant="secondary"
            onPress={() => void importData()}>
            Import
          </AppButton>
        </View>
        {backupMessage && (
          <AppText className={backupMessage.isError ? "text-danger" : "text-muted"}>
            {backupMessage.text}
          </AppText>
        )}
        <View className="mt-6">
          <AiAccessSettings />
        </View>
      </ScrollView>
    </Screen>
  );
}
