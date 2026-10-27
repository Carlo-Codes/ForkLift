import {
  router, Stack, useFocusEffect
} from "expo-router";
import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  Alert, FlatList, Switch, View
} from "react-native";
import type { GestureResponderEvent, TextInputInstance } from "react-native";

import {
  DEFAULT_WORKOUT_NAMES,
  createNextDayWorkout,
  createPlanWithDefaultWorkouts,
  deleteExerciseEntry,
  deleteWorkout,
  getPlan,
  getSettings,
  groupBlocks,
  listBlocks,
  listWorkouts,
  reorderBlocks,
  reorderExerciseEntries,
  restoreExerciseEntry,
  setActivePlan,
  setRoundRest,
  toCalendarDay,
  ungroupBlock,
  updateExerciseEntry,
  updatePlan,
  updateWorkout
} from "@forklift/core";
import type { BlockWithEntries, ExerciseEntryRemoval } from "@forklift/core";
import type {
  PlanAttributes, Unit, WorkoutAttributes
} from "@forklift/db/client";

import { AppButton } from "./AppButton";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { BlockItem } from "./BlockItem";
import { Card } from "./Card";
import { DateChip } from "./DateChip";
import { EmptyState } from "./EmptyState";
import type { EditError, EntryEditing } from "./ExerciseEntryRow";
import { moveId } from "./OrderedRow";
import { Screen } from "./Screen";
import { Snackbar } from "./Snackbar";
import { WorkoutTabs } from "./WorkoutTabs";

import { confirmDeletePlan } from "@/confirmDeletePlan";
import { errorMessage } from "@/errorMessage";
import { formatList } from "@/format";
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

// Runs a write, returning the message of the error it threw (e.g. a
// ValidationError's), or undefined when it saved.
function errorFrom(write: () => void): string | undefined {
  try {
    write();

    return undefined;
  } catch (e) {
    return errorMessage(e);
  }
}

// How far a touch can move and still be a tap, in points.
const TAP_SLOP = 10;

// The open Exercise Entry editor closes on a tap anywhere else in the editor
// (a scroll leaves it open). The editor's own touches, and the long-press
// that opens it, mark themselves as inside before the touch ends here.
function useTapOutside(onTapOutside: () => void) {
  const inside = useRef(false);

  const start = useRef({
    x: 0,
    y: 0
  });

  return {
    markInside: () => {
      inside.current = true;
    },
    handlers: {
      onTouchStart: ({ nativeEvent }: GestureResponderEvent) => {
        start.current = {
          x: nativeEvent.pageX,
          y: nativeEvent.pageY
        };
      },
      onTouchEnd: ({ nativeEvent }: GestureResponderEvent) => {
        const moved = Math.hypot(nativeEvent.pageX - start.current.x, nativeEvent.pageY - start.current.y) > TAP_SLOP;

        if (!inside.current && !moved) {
          onTapOutside();
        }

        inside.current = false;
      },
      onTouchCancel: () => {
        inside.current = false;
      }
    }
  };
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
    <AppTextInput ref={ref}
      variant="plain"
      className="py-1 font-Inter_Bold text-3xl"
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder="Plan name"
      placeholderTextColor={colors.faint}
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
  // Why the name last typed wasn't saved (e.g. it's empty): shown only once
  // editing ends, not while the lifter is mid-way through retyping it.
  const unsavedName = useRef<string>(undefined);
  const [ nameError, setNameError ] = useState<string>();
  const [ dateError, setDateError ] = useState<string>();
  // The Exercise Entry whose editor is open, and the last edit that failed.
  const [ editingId, setEditingId ] = useState<string>();
  const [ editError, setEditError ] = useState<EditError>();
  // The Exercise Entry just removed, while its Undo shows.
  const [ removed, setRemoved ] = useState<{ removal: ExerciseEntryRemoval; name: string }>();
  const tapOutside = useTapOutside(() => setEditingId(undefined));
  // Re-read on focus, coming back from the exercise picker, and
  // whenever the Plan is saved or another Workout is selected.
  const refresh = useCallback(() => setState(planId ? loadEditor(planId, workoutId) : undefined), [ planId, workoutId ]);

  useFocusEffect(refresh);

  // Saved on every change. Only the name changes, so the Plan is updated in
  // place rather than re-reading the whole editor.
  const changeName = (text: string) => {
    setName(text);

    if (planId) {
      unsavedName.current = errorFrom(() => {
        const plan = updatePlan(planId, { name: text });

        setState(current => current && {
          ...current,
          plan
        });
      });
    } else if (text.trim()) {
      unsavedName.current = errorFrom(() => setPlanId(createPlanWithDefaultWorkouts({ name: text }).id));
    }

    if (!unsavedName.current) {
      setNameError(undefined);
    }
  };

  // A name left invalid (e.g. empty) shows why and goes back to the one saved.
  const endNameEditing = () => {
    setNameError(unsavedName.current);

    if (state && unsavedName.current) {
      setName(state.plan.name);
    }

    unsavedName.current = undefined;
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

  // Saves an edit to an Exercise Entry or Superset, showing why it didn't
  // save on it.
  const edit = (on: Omit<EditError, "message">, write: () => void) => {
    const message = errorFrom(write);

    setEditError(message === undefined ? undefined : {
      ...on,
      message
    });
    refresh();
  };

  const onEntry = (entry: { id: string }) => ({
    kind: "entry",
    id: entry.id
  }) as const;

  const editing: EntryEditing = {
    editingId,
    error: editError,
    onEdit: entry => {
      tapOutside.markInside();
      setEditError(undefined);
      setEditingId(entry.id);
    },
    onChange: (entry, changes) => edit(onEntry(entry), () => updateExerciseEntry(entry.id, changes)),
    // No confirmation: Undo shows instead.
    onRemove: entry => edit(onEntry(entry), () => {
      const removal = deleteExerciseEntry(entry.id);

      setEditingId(undefined);

      setRemoved({
        removal,
        name: entry.exercise.name
      });
    }),
    onTouchInside: tapOutside.markInside
  };

  const undoRemove = (removal: ExerciseEntryRemoval) => {
    const message = errorFrom(() => restoreExerciseEntry(removal));

    setRemoved(undefined);
    refresh();

    if (message) {
      Alert.alert("Couldn't undo", message);
    }
  };

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
              setDateError(errorFrom(() => updatePlan(state.plan.id, dates)));
              refresh();
            }}
            onSelect={setWorkoutId}
            onChanged={refresh} />
        ) :
        (
          <AppText className="text-muted">
            Name your plan to start it with {formatList(DEFAULT_WORKOUT_NAMES)} workouts. Changes save as you go.
          </AppText>
        )}
    </View>
  );

  return (
    <Screen {...tapOutside.handlers}>
      {header}
      <FlatList
        data={blocks}
        keyExtractor={b => b.id}
        contentContainerClassName="gap-1 px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={state && (
          <EmptyState icon="barbell-outline"
            message={workout ? `No exercises in ${workout.name} yet.` : "No workouts yet. Tap + to add one."} />
        )}
        renderItem={({ item, index }) => {
          const next = blocks[ index + 1 ];

          return (
            <BlockItem block={item}
              unit={state!.unit}
              editing={editing}
              onSetRoundRest={restSeconds => edit({
                kind: "superset",
                id: item.id
              }, () => setRoundRest(item.id, restSeconds))}
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
      {removed && (
        <Snackbar key={removed.removal.exerciseEntryId}
          message={`Removed ${removed.name}`}
          actionLabel="Undo"
          onAction={() => undoRemove(removed.removal)}
          onHide={() => setRemoved(undefined)} />
      )}
    </Screen>
  );
}
