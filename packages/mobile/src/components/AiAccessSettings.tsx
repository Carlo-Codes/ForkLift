import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import {
  Alert, Platform, Switch, View
} from "react-native";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";

import {
  AI_ACCESS_IDLE_MINUTES,
  getAiAccessState,
  regeneratePairingToken,
  startAiAccess,
  stopAiAccess,
  subscribeAiAccess
} from "@/aiAccess/aiAccess";

const BACKGROUND_LIMIT = Platform.OS === "android" ?
  "It keeps running while ForkLift is in the background, with a notification." :
  "It only works while ForkLift is open on screen.";

function CopyableValue({
  label, value, action
}: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <View className="gap-1">
      <AppText weight="semibold"
        className="text-brand-darkGray">
        {label}
      </AppText>
      <AppText selectable
        className="text-brand-darkGray">
        {value}
      </AppText>
      <View className="flex-row gap-3">
        <AppButton variant="outline"
          accessibilityLabel={`Copy ${label.toLowerCase()}`}
          onPress={() => void Clipboard.setStringAsync(value)}>
          Copy
        </AppButton>
        {action}
      </View>
    </View>
  );
}

export function AiAccessSettings() {
  const state = useSyncExternalStore(subscribeAiAccess, getAiAccessState);
  const toggle = (on: boolean) => void (on ? startAiAccess() : stopAiAccess());

  const regenerate = () => Alert.alert(
    "Regenerate the pairing token?",
    "Any AI app using the current token loses access until you paste in the new one.",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Regenerate",
        style: "destructive",
        onPress: () => regeneratePairingToken()
      }
    ]
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText weight="semibold"
          className="text-lg text-brand-darkGray">
          AI Access
        </AppText>
        <Switch
          accessibilityLabel="AI Access"
          value={state.status === "on" || state.status === "starting"}
          disabled={state.status === "starting"}
          trackColor={{ true: "#E8590C" }}
          onValueChange={toggle}
        />
      </View>
      <AppText className="text-brand-mediumGray">
        Lets an AI assistant on a computer on the same Wi-Fi read your Plans, Exercise Library and
        history, and change your Plans, Workouts and Exercises. It can never change a Session, in
        progress or finished, and everything it changes can be undone. Paste the address and pairing token into a desktop AI app that supports MCP.
        Cloud-hosted AI apps, such as ones in a web browser, can&apos;t reach your phone.
        {" "}{BACKGROUND_LIMIT} It switches itself off after {AI_ACCESS_IDLE_MINUTES} minutes without use.
      </AppText>
      {state.status === "on" && (
        <>
          {!state.onWifi && (
            <AppText className="text-brand-error">
              Your phone isn&apos;t on Wi-Fi, so an AI app on your computer may not reach it.
            </AppText>
          )}
          {state.address ?
            <CopyableValue label="Address"
              value={state.address} /> :
            (
              <AppText className="text-brand-error">
                ForkLift couldn&apos;t find your phone&apos;s address on the network.
              </AppText>
            )}
          <CopyableValue
            label="Pairing token"
            value={state.token}
            action={(
              <AppButton variant="outline"
                onPress={regenerate}>
                Regenerate
              </AppButton>
            )}
          />
        </>
      )}
      <AppButton variant="outline"
        className="self-start py-2"
        onPress={() => router.push("/ai-changes")}>
        Changes by AI
      </AppButton>
      {state.status === "off" && state.switchedOffIdle && (
        <AppText className="text-brand-mediumGray">
          AI Access switched itself off after {AI_ACCESS_IDLE_MINUTES} minutes without use.
        </AppText>
      )}
      {state.status === "error" && (
        <AppText className="text-brand-error">
          AI Access couldn&apos;t start: {state.message}
        </AppText>
      )}
    </View>
  );
}
