import {
  router, Stack, useFocusEffect
} from "expo-router";
import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  Alert, FlatList, Switch, TextInput, View
} from "react-native";
import type { TextInputInstance } from "react-native";

import {
  createNextDayWorkout,
  createPlanWithDefaultWorkouts,
  deleteWorkout,
  getPlan,
  getSettings,
  groupBlocks,
  listBlocks,
  listWorkouts,
  reorderBlocks,
  reorderExerciseEntries,
  setActivePlan,
  toCalendarDay,
  ungroupBlock,
  updatePlan,
  updateWorkout
} from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import type {
  PlanAttributes, Unit, WorkoutAttributes
} from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { BlockItem } from "./BlockItem";
import { Card } from "./Card";
import { DateChip } from "./DateChip";
import { EmptyState } from "./EmptyState";
import { moveId } from "./OrderedRow";
import { Screen } from "./Screen";
import { WorkoutTabs } from "./WorkoutTabs";

import { confirmDeletePlan } from "@/confirmDeletePlan";
import { useThemeColors } from "@/theme";

interface EditorState {
  plan: PlanAttributes;
  workouts: WorkoutAttributes[];
  // The selected Workout: the first while none is chosen or once it's deleted.
  workout: WorkoutAttributes | undefined;
  blocks: BlockWithEntries[];
  unit: Unit;
}

function loadEditor(planId: string, workoutId: string | undefined): EditorState | undefined {
  try {
    const plan = getPlan(planId);
    const workouts = listWorkouts(planId);
    const workout = workouts.find(w => w.id === workoutId) ?? workouts[ 0 ];

    return {
      plan,
      workouts,
      workout,
      blocks: workout ? listBlocks(workout.id) : [],
      // Re-read with the blocks: a unit switch converts their weights.
      unit: getSettings().unit
    };
  } catch {
    return undefined;
  }
}

// Runs a write, returning its error message (e.g. a ValidationError's) rather
// than throwing.
function attempt(write: () => void): string | undefined {
  try {
    write();

    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// The Plan's name as a large title edited in place.
function TitleInput({
  value, focusOnMount, onChangeText, onEndEditing
}: {
  value: string;
  focusOnMount: boolean;
  onChangeText: (name: string) => void;
  onEndEditing: () => void;
}) {
  const colors = useThemeColors();
  const ref = useRef<TextInputInstance>(null);

  // jsx-a11y bans the autoFocus prop, so a new Plan's name is focused here.
  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [ focusOnMount ]);

  return (
    <TextInput ref={ref}
      className="py-1 font-Inter_Bold text-3xl text-ink"
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder="Plan name"
      placeholderTextColor={colors.faint}
      selectionColor={colors.accent}
      returnKeyType="done"
      accessibilityLabel="Plan name" />
  );
}

// The Plan's dates, Active toggle and Workout tabs, above the selected
// Workout's Exercise Entries.
function PlanSettings({
  state, dateError, onSetDates, onSelect, onChanged
}: {
  state: EditorState;
  dateError: string | undefined;
  onSetDates: (dates: Partial<Pick<PlanAttributes, "startDate" | "endDate">>) => void;
  onSelect: (workoutId: string | undefined) => void;
  onChanged: () => void;
}) {
  const colors = useThemeColors();

  const {
    plan, workouts, workout
  } = state;

  const today = toCalendarDay(new Date());

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        <DateChip label="From"
          day={plan.startDate ?? null}
          fallback={plan.endDate ?? today}
          onChange={startDate => onSetDates({ startDate })} />
        <DateChip label="To"
          day={plan.endDate ?? null}
          fallback={plan.startDate ?? today}
          onChange={endDate => onSetDates({ endDate })} />
      </View>
      {dateError && <AppText className="text-danger">{dateError}</AppText>}
      <Card className="min-h-touch flex-row items-center gap-3 px-4 py-1">
        <AppText className="flex-1 text-ink">Active Plan</AppText>
        <Switch value={plan.isActive}
          trackColor={{ true: colors.accent }}
          accessibilityLabel="Active Plan"
          onValueChange={on => {
            setActivePlan(on ? plan.id : null);
            onChanged();
          }} />
      </Card>
      <WorkoutTabs workouts={workouts}
        selectedId={workout?.id}
        onSelect={onSelect}
        onRename={(id, name) => {
          updateWorkout(id, { name });
          onChanged();
        }}
        onDelete={id => {
          deleteWorkout(id);
          onChanged();
        }}
        onAdd={() => onSelect(createNextDayWorkout(plan.id).id)} />
    </>
  );
}

// Creating and editing a Plan on one page. Without planId it opens as a draft
// with the name focused; the Plan is saved, with its default Workouts, once
// the name has a character, and from then on every change saves straight away.
export function PlanEditor({ planId: openedPlanId }: { planId?: string }) {
  const [ planId, setPlanId ] = useState(openedPlanId);
  const [ workoutId, setWorkoutId ] = useState<string>();
  const [ state, setState ] = useState(() => (planId ? loadEditor(planId, workoutId) : undefined));
  const [ name, setName ] = useState(state ? state.plan.name : "");
  const [ nameError, setNameError ] = useState<string>();
  const [ dateError, setDateError ] = useState<string>();
  // Re-read on focus, coming back from the exercise picker or targets, and
  // whenever the Plan is saved or another Workout is selected.
  const refresh = useCallback(() => setState(planId ? loadEditor(planId, workoutId) : undefined), [ planId, workoutId ]);

  useFocusEffect(refresh);

  const changeName = (text: string) => {
    setName(text);

    if (planId) {
      setNameError(attempt(() => updatePlan(planId, { name: text })));
      refresh();
    } else if (text.trim()) {
      setNameError(attempt(() => setPlanId(createPlanWithDefaultWorkouts({ name: text }).id)));
    }
  };

  // A name left invalid (e.g. empty) goes back to the one saved.
  const endNameEditing = () => {
    if (state && nameError) {
      setName(state.plan.name);
      setNameError(undefined);
    }
  };

  const header = (
    <Stack.Screen options={{
      headerRight: state ?
        () => (
          <AppButton className="min-h-touch min-w-touch items-center justify-center"
            accessibilityLabel="Plan options"
            onPress={() => Alert.alert(state.plan.name, undefined, [
              {
                text: "Delete plan",
                style: "destructive",
                onPress: () => confirmDeletePlan(state.plan, () => router.back())
              },
              {
                text: "Cancel",
                style: "cancel"
              }
            ])}>
            <AppIcon name="ellipsis-horizontal-circle"
              color="accent"
              size={26} />
          </AppButton>
        ) :
        undefined
    }} />
  );

  if (planId && !state) {
    return (
      <Screen>
        {header}
        <EmptyState icon="alert-circle-outline"
          message="This plan no longer exists." />
      </Screen>
    );
  }

  const workout = state ? state.workout : undefined;
  const blocks = state ? state.blocks : [];

  const writeThenRefresh = (write: () => void) => () => {
    write();
    refresh();
  };

  const moveBlock = (index: number, delta: -1 | 1) => writeThenRefresh(() => reorderBlocks(workout!.id, moveId(blocks.map(b => b.id), index, delta)));

  const addExercise = (blockId?: string) => router.push({
    pathname: "/workouts/add-exercise",
    params: {
      workoutId: workout!.id,
      ...(blockId && { blockId })
    }
  });

  // The title stays at the same place in the tree as the draft is saved, so
  // the field keeps focus and the keyboard while the lifter types on.
  const listHeader = (
    <View className="gap-4 py-4">
      <View className="gap-1">
        <TitleInput value={name}
          focusOnMount={!openedPlanId}
          onChangeText={changeName}
          onEndEditing={endNameEditing} />
        {nameError && <AppText className="text-danger">{nameError}</AppText>}
      </View>
      {state ?
        (
          <PlanSettings state={state}
            dateError={dateError}
            onSetDates={dates => {
              setDateError(attempt(() => updatePlan(state.plan.id, dates)));
              refresh();
            }}
            onSelect={setWorkoutId}
            onChanged={refresh} />
        ) :
        (
          <AppText className="text-muted">
            Name your plan to start it with Push, Pull and Legs workouts. Changes save as you go.
          </AppText>
        )}
    </View>
  );

  return (
    <Screen>
      {header}
      <FlatList
        data={blocks}
        keyExtractor={b => b.id}
        contentContainerClassName="gap-1 px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={state && (
          <AppText className="py-2 text-muted">
            {workout ? `No exercises in ${workout.name} yet.` : "No workouts yet. Tap + to add one."}
          </AppText>
        )}
        renderItem={({ item, index }) => {
          const next = blocks[ index + 1 ];

          return (
            <BlockItem block={item}
              unit={state!.unit}
              onPressEntry={entry => router.push({
                pathname: "/entries/[id]",
                params: { id: entry.id }
              })}
              onMoveEntry={(entryIndex, delta) => writeThenRefresh(() => reorderExerciseEntries(item.id, moveId(item.exerciseEntries.map(e => e.id), entryIndex, delta)))()}
              onAddToSuperset={() => addExercise(item.id)}
              onUngroup={writeThenRefresh(() => ungroupBlock(item.id))}
              onSupersetWithNext={next && writeThenRefresh(() => groupBlocks(workout!.id, [ item.id, next.id ]))}
              onMoveUp={index > 0 ? moveBlock(index, -1) : undefined}
              onMoveDown={next ? moveBlock(index, 1) : undefined} />
          );
        }}
        ListFooterComponent={workout && (
          <AppButton variant="secondary"
            className="mt-3 self-start"
            onPress={() => addExercise()}>
            <AppIcon name="add"
              color="accent"
              size={20} />
            <AppText weight="semibold"
              className="text-accent">
              Add exercise
            </AppText>
          </AppButton>
        )} />
    </Screen>
  );
}
