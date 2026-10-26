import { router, useLocalSearchParams } from "expo-router";
import {
  useEffect, useRef, useState
} from "react";
import {
  Alert, Switch, Vibration, View
} from "react-native";

import {
  completeSet, finishSession, getCurrentStep, getSettings, setIncrease, skipExercise, skipSet
} from "@forklift/core";
import type { SessionSet, SessionStep } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import {
  formatSet, formatSets, formatSupersetPosition, toNumber
} from "@/format";

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

// Increase Next Time for one Exercise Entry: raises its target weight by its
// Weight Step when the Session ends.
function IncreaseToggle({
  label, on, onChange
}: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-center gap-3">
      <AppText className="text-lg text-brand-mediumGray">{label}</AppText>
      <Switch value={on}
        accessibilityLabel={label}
        onValueChange={onChange} />
    </View>
  );
}

// The ⋯ menu: skip this set, skip the rest of this exercise, or finish early,
// with children (every entry's Increase Next Time toggle) shown above.
function WorkoutMenu({
  onSkipSet, onSkipExercise, onFinish, children
}: { onSkipSet: () => void; onSkipExercise: () => void; onFinish: () => void; children?: React.ReactNode }) {
  const [ open, setOpen ] = useState(false);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <View className="items-end gap-2">
      <AppButton className="px-3 py-1"
        accessibilityRole="button"
        accessibilityLabel="Workout options"
        onPress={() => setOpen(o => !o)}>
        <AppText weight="semibold"
          className="text-2xl text-brand-darkGray">
          ⋯
        </AppText>
      </AppButton>
      {open && (
        <View className="gap-2">
          {children}
          <AppButton variant="outline"
            className="py-2"
            onPress={choose(onSkipSet)}>
            Skip set
          </AppButton>
          <AppButton variant="outline"
            className="py-2"
            onPress={choose(onSkipExercise)}>
            Skip exercise
          </AppButton>
          <AppButton variant="outline"
            className="py-2"
            onPress={choose(onFinish)}>
            Finish workout
          </AppButton>
        </View>
      )}
    </View>
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
  const increaseOn = (exerciseEntryId: string) => step.increases.includes(exerciseEntryId);

  // Flipping a toggle saves at once; the step keeps its set and rest.
  const toggleIncrease = (exerciseEntryId: string) => (on: boolean) => {
    try {
      setStep(setIncrease(id, exerciseEntryId, on));
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Done, Skip set and Skip exercise all save at once and move to the next step.
  const advance = (move: () => SessionStep) => () => {
    try {
      setStep(move());
      setNow(Date.now());
      setActual(undefined);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const done = advance(() => completeSet(id, actual && {
    reps: toNumber(actual.reps),
    weight: toNumber(actual.weight)
  }));

  const finish = () => {
    try {
      finishSession(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));

      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const finishEarly = () => Alert.alert(
    "Finish workout?",
    "The sets you've done are saved, and the rest are recorded as skipped.",
    [
      {
        text: "Keep going",
        style: "cancel"
      },
      {
        text: "Finish",
        onPress: finish
      }
    ]
  );

  // Every entry's toggle, so any of them can be flipped at any time, also
  // before finishing early.
  const increaseToggles = (
    <View className="gap-2">
      {step.session.blocks.flat().map(entry => (
        <IncreaseToggle key={entry.exerciseEntryId}
          label={`Increase ${entry.exerciseName} next time`}
          on={increaseOn(entry.exerciseEntryId)}
          onChange={toggleIncrease(entry.exerciseEntryId)} />
      ))}
    </View>
  );

  const menu = (
    <WorkoutMenu onSkipSet={advance(() => skipSet(id))}
      onSkipExercise={advance(() => skipExercise(id))}
      onFinish={finishEarly}>
      {increaseToggles}
    </WorkoutMenu>
  );

  if (!current) {
    return (
      <View className="flex-1 justify-center gap-6 bg-brand-white p-6">
        <AppText weight="semibold"
          className="text-center text-2xl text-brand-darkGray">
          All sets done
        </AppText>
        {increaseToggles}
        {error && <AppText className="text-center text-brand-error">{error}</AppText>}
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
        {menu}
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
        {menu}
        {current.superset && (
          <AppText weight="semibold"
            className="text-center text-lg text-brand-primary">
            {formatSupersetPosition(current.setNumber, current.superset)}
          </AppText>
        )}
        <AppText weight="semibold"
          className="text-center text-2xl text-brand-darkGray">
          {current.exerciseName}
        </AppText>
        <AppText className="text-center text-lg text-brand-mediumGray">
          Set {current.setNumber} of {current.totalSets}
        </AppText>
        {step.lastTime && (
          <AppText className="text-center text-brand-mediumGray">
            Last time: {formatSets(step.lastTime.sets, unit)}
          </AppText>
        )}
        <IncreaseToggle label="Increase next time"
          on={increaseOn(current.exerciseEntryId)}
          onChange={toggleIncrease(current.exerciseEntryId)} />
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
