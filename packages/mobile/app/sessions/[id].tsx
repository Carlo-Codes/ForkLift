import { router, useLocalSearchParams } from "expo-router";
import {
  useEffect, useRef, useState
} from "react";
import { Vibration, View } from "react-native";

import {
  completeSet, finishSession, getCurrentStep, getSettings
} from "@forklift/core";
import type { SessionSet, SessionStep } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { formatSet, toNumber } from "@/format";

const INPUT_CLASS = "min-w-24 rounded-lg border border-brand-lightGray px-3 py-2 text-center text-3xl text-brand-darkGray";

function loadStep(id: string): SessionStep | undefined {
  try {
    return getCurrentStep(id);
  } catch {
    return undefined;
  }
}

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function NextUp({ set, unit }: { set?: SessionSet; unit: Unit }) {
  return (
    <AppText className="text-center text-lg text-brand-mediumGray">
      {set ? `Next: ${set.exerciseName} ${formatSet(set.targetReps, set.targetWeight, unit)}` : "Last set"}
    </AppText>
  );
}

// Workout Mode: the current set, Done, the rest countdown and what's next. The
// order of sets and the rest due all come from @forklift/core.
export default function WorkoutModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ step, setStep ] = useState(() => loadStep(id));
  const [ unit ] = useState(() => getSettings().unit);
  const [ now, setNow ] = useState(() => Date.now());
  // The rest (by its end time) the lifter skipped, and the one already buzzed.
  const [ skippedRest, setSkippedRest ] = useState<number>();
  const vibratedRest = useRef<number>(undefined);
  // What the lifter actually did, while they're adjusting the numbers.
  const [ actual, setActual ] = useState<{ reps: string; weight: string }>();
  const [ error, setError ] = useState<string>();
  const restEndsAt = step?.rest?.endsAt.getTime();
  const resting = restEndsAt !== undefined && restEndsAt !== skippedRest && restEndsAt > now;

  useEffect(() => {
    if (restEndsAt === undefined || restEndsAt === skippedRest) {
      return;
    }

    const timer = setInterval(() => {
      const time = Date.now();

      setNow(time);

      if (time >= restEndsAt && vibratedRest.current !== restEndsAt) {
        vibratedRest.current = restEndsAt;

        Vibration.vibrate([
          0,
          400,
          200,
          400
        ]);
      }

      if (time >= restEndsAt) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [ restEndsAt, skippedRest ]);

  if (!step) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-white p-6">
        <AppText className="text-brand-mediumGray">This session no longer exists.</AppText>
      </View>
    );
  }

  const { current, next } = step;

  const done = () => {
    try {
      const nextStep = completeSet(id, actual && {
        reps: toNumber(actual.reps),
        weight: toNumber(actual.weight)
      });

      setStep(nextStep);
      setNow(Date.now());
      setActual(undefined);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const finish = () => {
    finishSession(id);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  if (!current) {
    return (
      <View className="flex-1 justify-center gap-6 bg-brand-white p-6">
        <AppText weight="semibold"
          className="text-center text-2xl text-brand-darkGray">
          All sets done
        </AppText>
        <AppButton variant="primary"
          className="py-6"
          onPress={finish}>
          Finish workout
        </AppButton>
      </View>
    );
  }

  if (resting) {
    return (
      <View className="flex-1 justify-center gap-6 bg-brand-white p-6">
        <AppText className="text-center text-lg text-brand-mediumGray">Rest</AppText>
        <AppText weight="semibold"
          className="text-center text-7xl text-brand-darkGray"
          accessibilityLiveRegion="polite">
          {formatCountdown(restEndsAt - now)}
        </AppText>
        <NextUp set={current}
          unit={unit} />
        <AppButton variant="outline"
          className="items-center self-center px-6 py-2"
          onPress={() => setSkippedRest(restEndsAt)}>
          Skip rest
        </AppButton>
      </View>
    );
  }

  const field = (key: "reps" | "weight") => ({
    value: actual?.[ key ] ?? "",
    onChangeText: (text: string) => setActual(a => a && {
      ...a,
      [ key ]: text
    })
  });

  return (
    <View className="flex-1 justify-between gap-6 bg-brand-white p-6">
      <View className="gap-2">
        <AppText weight="semibold"
          className="text-center text-2xl text-brand-darkGray">
          {current.exerciseName}
        </AppText>
        <AppText className="text-center text-lg text-brand-mediumGray">
          Set {current.setNumber} of {current.totalSets}
        </AppText>
      </View>
      {actual ?
        (
          <View className="flex-row items-center justify-center gap-3">
            <AppTextInput className={INPUT_CLASS}
              keyboardType="decimal-pad"
              accessibilityLabel={`Weight (${unit})`}
              selectTextOnFocus
              {...field("weight")} />
            <AppText className="text-2xl text-brand-mediumGray">{unit} ×</AppText>
            <AppTextInput className={INPUT_CLASS}
              keyboardType="number-pad"
              accessibilityLabel="Reps"
              selectTextOnFocus
              {...field("reps")} />
          </View>
        ) :
        (
          <AppButton accessibilityRole="button"
            accessibilityHint="Change the weight or reps you actually did"
            onPress={() => setActual({
              reps: String(current.targetReps),
              weight: String(current.targetWeight)
            })}>
            <AppText weight="semibold"
              className="text-center text-5xl text-brand-darkGray">
              {formatSet(current.targetReps, current.targetWeight, unit)}
            </AppText>
            <AppText className="text-center text-sm text-brand-mediumGray">Tap to change</AppText>
          </AppButton>
        )}
      <View className="gap-4">
        {error && <AppText className="text-center text-brand-error">{error}</AppText>}
        <AppButton variant="primary"
          className="py-6"
          onPress={done}>
          <AppText weight="semibold"
            className="text-2xl text-brand-white">
            Done
          </AppText>
        </AppButton>
        <NextUp set={next}
          unit={unit} />
      </View>
    </View>
  );
}
