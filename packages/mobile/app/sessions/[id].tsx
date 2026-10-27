import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  router, Stack, useLocalSearchParams
} from "expo-router";
import {
  useEffect, useRef, useState
} from "react";
import {
  Alert, Pressable, ScrollView, Switch, Vibration, View
} from "react-native";

import {
  completeSet, finishSession, getCurrentStep, getSettings, setIncrease, skipExercise, skipRest, skipSet
} from "@forklift/core";
import type { SessionSet, SessionStep } from "@forklift/core";
import type { Unit } from "@forklift/db/client";

import { AppButton } from "@/components/AppButton";
import { AppIcon } from "@/components/AppIcon";
import type { IconName } from "@/components/AppIcon";
import { AppText } from "@/components/AppText";
import { AppTextInput } from "@/components/AppTextInput";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import {
  formatCountdown, formatSet, formatSets, formatSetTargets, formatSupersetPosition, toNumber
} from "@/format";
import { useThemeColors } from "@/theme";
import { errorMessage } from "@/errorMessage";

const KEEP_AWAKE_TAG = "workout-mode";
const INPUT_CLASS = "min-w-[96px] text-center text-3xl";

function loadStep(id: string): SessionStep | undefined {
  try {
    return getCurrentStep(id);
  } catch {
    return undefined;
  }
}

function NextUp({ set, unit }: { set?: SessionSet; unit: Unit }) {
  return (
    <AppText className="text-center text-muted">
      {set ? `Next: ${set.exerciseName} ${formatSet(set.targetReps, set.targetWeight, unit)}` : "Last set"}
    </AppText>
  );
}

// The rest countdown as "1:30". Inline style: NativeWind's tabular-nums has no
// native style.
function Countdown({ ms, className }: { ms: number; className: string }) {
  return (
    <AppText weight="semibold"
      className={className}
      style={{ fontVariant: [ "tabular-nums" ] }}
      accessibilityLiveRegion="polite">
      {formatCountdown(ms)}
    </AppText>
  );
}

// Increase Next Time for one Exercise Entry: raises its target weight by its
// Weight Step when the Session ends. One row of a card.
function IncreaseToggle({
  label, on, onChange, first = true
}: { label: string; on: boolean; onChange: (on: boolean) => void; first?: boolean }) {
  const colors = useThemeColors();

  return (
    <View className={`min-h-touch flex-row items-center gap-3 px-4 py-1${first ? "" : " border-t border-separator"}`}>
      <AppText className="flex-1 text-ink">{label}</AppText>
      <Switch value={on}
        trackColor={{ true: colors.accent }}
        accessibilityLabel={label}
        onValueChange={onChange} />
    </View>
  );
}

// One action in the ⋯ menu.
function MenuItem({
  icon, label, onPress
}: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <AppButton className="min-h-touch flex-row items-center gap-3 border-t border-separator px-4"
      accessibilityRole="menuitem"
      onPress={onPress}>
      <AppIcon name={icon}
        color="accent"
        size={20} />
      <AppText className="text-ink">{label}</AppText>
    </AppButton>
  );
}

// The ⋯ menu, opened from the header: skip this set, skip the rest of this
// exercise, or finish early, with children (every entry's Increase Next Time
// toggle) above. A card over the screen; tapping outside it closes it.
function WorkoutMenu({
  onClose, onSkipSet, onSkipExercise, onFinish, children
}: {
  onClose: () => void;
  onSkipSet: () => void;
  onSkipExercise: () => void;
  onFinish: () => void;
  children?: React.ReactNode;
}) {
  const choose = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <View className="absolute inset-0 items-end p-4">
      <Pressable className="absolute inset-0"
        accessibilityRole="button"
        accessibilityLabel="Close workout options"
        onPress={onClose} />
      <Card className="max-h-[90%] w-80 max-w-full"
        accessibilityViewIsModal>
        <ScrollView>
          {children}
          <MenuItem icon="play-skip-forward-outline"
            label="Skip set"
            onPress={choose(onSkipSet)} />
          <MenuItem icon="play-forward-outline"
            label="Skip exercise"
            onPress={choose(onSkipExercise)} />
          <MenuItem icon="flag-outline"
            label="Finish workout"
            onPress={choose(onFinish)} />
        </ScrollView>
      </Card>
    </View>
  );
}

// Workout Mode: the current set, Done, the rest countdown and what's next. The
// order of sets and the rest due all come from @forklift/core. A Changeover
// shows the next exercise first, with the countdown small under it. It sits on the
// root stack, so it has no tab bar, only a small header with Back.
export default function WorkoutModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ step, setStep ] = useState(() => loadStep(id));
  const [ unit ] = useState(() => getSettings().unit);
  const [ now, setNow ] = useState(() => Date.now());
  // The rest (by its end time) already buzzed.
  const vibratedRest = useRef<number>(undefined);
  // What the lifter actually did, while they're adjusting the numbers.
  const [ actual, setActual ] = useState<{ reps: string; weight: string }>();
  const [ error, setError ] = useState<string>();
  const [ menuOpen, setMenuOpen ] = useState(false);
  const restEndsAt = step?.rest?.endsAt.getTime();
  const resting = restEndsAt !== undefined && restEndsAt > now;
  const setsLeft = step?.current !== undefined;

  // The rest countdown and its buzz run in JS, which stops once the phone
  // auto-locks, so the screen stays on while there are sets left. Leaving the
  // screen (finishing does too) lets it sleep again.
  useEffect(() => {
    if (!setsLeft) {
      return;
    }

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [ setsLeft ]);

  useEffect(() => {
    if (restEndsAt === undefined) {
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
  }, [ restEndsAt ]);

  if (!step) {
    return (
      <Screen className="justify-center">
        <EmptyState icon="alert-circle-outline"
          message="This session no longer exists." />
      </Screen>
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
      setError(errorMessage(e));
    }
  };

  // Done, Skip set, Skip exercise and Skip rest all save at once and show the step they lead to.
  const advance = (move: () => SessionStep) => () => {
    try {
      setStep(move());
      setNow(Date.now());
      setActual(undefined);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
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
      setError(errorMessage(e));

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
  const increaseToggles = step.session.blocks.flat().map((entry, i) => (
    <IncreaseToggle key={entry.exerciseEntryId}
      label={`Increase ${entry.exerciseName} next time`}
      on={increaseOn(entry.exerciseEntryId)}
      onChange={toggleIncrease(entry.exerciseEntryId)}
      first={i === 0} />
  ));

  // The small header keeps Back; while there are sets left it also has the ⋯
  // button, whose menu sits over the screen.
  const header = (
    <Stack.Screen options={{
      headerRight: current ?
        () => (
          <AppButton className="min-h-touch min-w-touch items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Workout options"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(open => !open)}>
            <AppIcon name="ellipsis-horizontal-circle"
              color="accent"
              size={26} />
          </AppButton>
        ) :
        undefined
    }} />
  );

  const menu = menuOpen && current && (
    <WorkoutMenu onClose={() => setMenuOpen(false)}
      onSkipSet={advance(() => skipSet(id))}
      onSkipExercise={advance(() => skipExercise(id))}
      onFinish={finishEarly}>
      {increaseToggles}
    </WorkoutMenu>
  );

  if (!current) {
    return (
      <Screen className="justify-center gap-6 p-4">
        {header}
        <View className="items-center gap-2">
          <AppIcon name="checkmark-circle"
            color="accent"
            size={56} />
          <AppText weight="semibold"
            className="text-center text-3xl text-ink">
            All sets done
          </AppText>
        </View>
        <Card>{increaseToggles}</Card>
        {error && <AppText className="text-center text-danger">{error}</AppText>}
        <AppButton variant="primary"
          onPress={finish}>
          Finish workout
        </AppButton>
      </Screen>
    );
  }

  const skipRestButton = (
    <AppButton variant="secondary"
      className="self-center"
      onPress={advance(() => skipRest(id))}>
      Skip rest
    </AppButton>
  );

  // A Changeover: the lifter is setting up the next exercise, so it comes first.
  if (resting && step.rest?.changeover) {
    return (
      <Screen className="justify-center gap-6 p-4">
        {header}
        <Card className="items-center gap-2 px-4 py-8">
          <AppText weight="semibold"
            className="text-sm uppercase text-muted">
            Up next
          </AppText>
          {current.superset && (
            <Badge>{formatSupersetPosition(current.setNumber, current.superset)}</Badge>
          )}
          <AppText weight="semibold"
            className="text-center text-4xl text-ink">
            {current.exerciseName}
          </AppText>
          <AppText weight="semibold"
            className="text-center text-2xl text-ink">
            {formatSetTargets(current, unit)}
          </AppText>
          {step.lastTime && (
            <AppText className="text-center text-lg text-muted">
              Last time: {formatSets(step.lastTime.sets, unit)}
            </AppText>
          )}
        </Card>
        <View className="items-center gap-2">
          <AppText weight="semibold"
            className="text-sm uppercase text-muted">
            Changeover
          </AppText>
          <Countdown ms={restEndsAt - now}
            className="text-3xl text-ink" />
          {skipRestButton}
        </View>
        {menu}
      </Screen>
    );
  }

  if (resting) {
    return (
      <Screen className="justify-center gap-6 p-4">
        {header}
        <Card className="items-center gap-2 px-4 py-8">
          <AppText weight="semibold"
            className="text-sm uppercase text-muted">
            Rest
          </AppText>
          <Countdown ms={restEndsAt - now}
            className="text-7xl text-ink" />
          <NextUp set={current}
            unit={unit} />
        </Card>
        {skipRestButton}
        {menu}
      </Screen>
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
    <Screen className="justify-between gap-6 p-4">
      {header}
      <View className="gap-4">
        <View className="items-center gap-1">
          {current.superset && (
            <Badge>{formatSupersetPosition(current.setNumber, current.superset)}</Badge>
          )}
          <AppText weight="semibold"
            className="text-center text-3xl text-ink">
            {current.exerciseName}
          </AppText>
          <AppText className="text-center text-lg text-muted">
            Set {current.setNumber} of {current.totalSets}
          </AppText>
          {step.lastTime && (
            <AppText className="text-center text-muted">
              Last time: {formatSets(step.lastTime.sets, unit)}
            </AppText>
          )}
        </View>
        <Card>
          <IncreaseToggle label="Increase next time"
            on={increaseOn(current.exerciseEntryId)}
            onChange={toggleIncrease(current.exerciseEntryId)} />
        </Card>
      </View>
      {actual ?
        (
          <Card className="flex-row items-center justify-center gap-3 px-4 py-6">
            <AppTextInput className={INPUT_CLASS}
              keyboardType="decimal-pad"
              accessibilityLabel={`Weight (${unit})`}
              selectTextOnFocus
              {...field("weight")} />
            <AppText className="text-2xl text-muted">{unit} ×</AppText>
            <AppTextInput className={INPUT_CLASS}
              keyboardType="number-pad"
              accessibilityLabel="Reps"
              selectTextOnFocus
              {...field("reps")} />
          </Card>
        ) :
        (
          <AppButton accessibilityRole="button"
            accessibilityHint="Change the weight or reps you actually did"
            onPress={() => setActual({
              reps: String(current.targetReps),
              weight: String(current.targetWeight)
            })}>
            <Card className="px-4 py-6">
              <AppText weight="semibold"
                className="text-center text-5xl text-ink">
                {formatSet(current.targetReps, current.targetWeight, unit)}
              </AppText>
              <AppText className="text-center text-sm text-muted">Tap to change</AppText>
            </Card>
          </AppButton>
        )}
      <View className="gap-4">
        {error && <AppText className="text-center text-danger">{error}</AppText>}
        <AppButton variant="primary"
          onPress={done}>
          <AppText weight="semibold"
            className="text-lg text-on-accent">
            Done
          </AppText>
        </AppButton>
        <NextUp set={next}
          unit={unit} />
      </View>
      {menu}
    </Screen>
  );
}
