import {
  router, Stack, useFocusEffect
} from "expo-router";
import {
  useCallback, useMemo, useRef, useState
} from "react";
import {
  Alert, ScrollView, Switch, View
} from "react-native";
import type { GestureResponderEvent } from "react-native";

import {
  createNextDayWorkout,
  createSuperset,
  deleteExerciseEntries,
  DEFAULT_PLAN_WEEKS,
  deleteWorkout,
  getPlan,
  getPlanProgress,
  getSettings,
  listBlocks,
  listWorkouts,
  MAX_PLAN_WEEKS,
  planDateRow,
  reorderBlocks,
  reorderExerciseEntries,
  reorderWorkouts,
  restoreExerciseEntries,
  setActivePlan,
  setPlanStart,
  setPlanWeeks,
  setRoundRest,
  toCalendarDay,
  ungroupExerciseEntries,
  updateExerciseEntry,
  updatePlan,
  updateWorkout
} from "@forklift/core";
import type {
  BlockWithEntries, ExerciseEntryRemoval, PlanProgress
} from "@forklift/core";
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
import {
  DragList, DragScrollContext, TAP_SLOP
} from "./DragList";
import { EmptyState } from "./EmptyState";
import { EntryListContext } from "./EntryListContext";
import type {
  EditError, EntryEditing, EntryList
} from "./EntryListContext";
import { Screen } from "./Screen";
import { SelectionBar } from "./SelectionBar";
import { Snackbar } from "./Snackbar";
import { Stepper } from "./Stepper";
import { useRowSelection } from "./useRowSelection";
import { WorkoutTabs } from "./WorkoutTabs";

import { confirmDeletePlan } from "@/confirmDeletePlan";
import { errorMessage } from "@/errorMessage";
import { formatCalendarDay, formatPlanProgress } from "@/format";
import { openRowAfterTap } from "@/openRow";
import { useThemeColors } from "@/theme";

interface EditorState {
  plan: PlanAttributes;
  progress: PlanProgress;
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
      progress: getPlanProgress(planId),
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

// Saves the new order a drag left (Workout tabs, Blocks or a Superset's
// entries), then re-reads the editor. One that can't be saved (e.g. the
// Workout changed meanwhile) says why, and the old order shows again.
function saveOrder(write: () => void, refresh: () => void) {
  const message = errorFrom(write);

  refresh();

  if (message) {
    Alert.alert("Couldn't move it", message);
  }
}

// The open Exercise Entry editor closes on a tap anywhere else in the editor
// (a scroll leaves it open). The rows and the open editor mark their touches
// as inside as they start, so a tap on a row only does what the row says
// (open, move or close the editor).
function useTapOutside(onTapOutside: () => void) {
  const inside = useRef(false);
  const tapOutside = useRef(onTapOutside);

  const start = useRef({
    x: 0,
    y: 0
  });

  tapOutside.current = onTapOutside;

  // The same handlers every render, so what's built on them can be memoised.
  return useMemo(() => ({
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
          tapOutside.current();
        }

        inside.current = false;
      },
      onTouchCancel: () => {
        inside.current = false;
      }
    }
  }), []);
}

// The Plan's name as a large title edited in place.
function TitleInput({
  value, onChangeText, onEndEditing
}: {
  value: string;
  onChangeText: (name: string) => void;
  onEndEditing: () => void;
}) {
  const colors = useThemeColors();

  return (
    <AppTextInput variant="plain"
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

// The Plan's dates as the New plan form picks them: a "Starts [date]" chip and a
// Weeks stepper, still saved as From and To (ADR-0006). A To that isn't a whole number of
// weeks after From (set by the AI) shows its weeks rounded up and stays until
// the lifter changes the start date or weeks. Clearing the start date clears
// both. A To the AI set without a From shows, with a "×" to clear it, until a
// start date replaces it.
function PlanDates({
  plan, error, onSetDates
}: {
  plan: PlanAttributes;
  error: string | undefined;
  onSetDates: (write: () => void) => void;
}) {
  const {
    startDate, weeks, endDate
  } = planDateRow(plan);

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <DateChip label="Starts"
          day={startDate}
          fallback={toCalendarDay(new Date())}
          placeholder="Set start date"
          onChange={day => onSetDates(() => setPlanStart(plan.id, day))} />
        {startDate && weeks === null && (
          <AppButton variant="link"
            onPress={() => onSetDates(() => setPlanWeeks(plan.id, DEFAULT_PLAN_WEEKS))}>
            Set weeks
          </AppButton>
        )}
        {!startDate && endDate && (
          <View className="flex-row items-center">
            <AppText className="text-muted">Ends {formatCalendarDay(endDate)}</AppText>
            <AppButton className="min-h-touch min-w-touch items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Clear end date"
              onPress={() => onSetDates(() => updatePlan(plan.id, { endDate: null }))}>
              <AppIcon name="close"
                color="muted"
                size={18} />
            </AppButton>
          </View>
        )}
      </View>
      {weeks !== null && (
        <Stepper label="Weeks"
          value={weeks}
          step={1}
          min={1}
          max={Math.max(MAX_PLAN_WEEKS, weeks)}
          onChange={next => onSetDates(() => setPlanWeeks(plan.id, next))} />
      )}
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}

// The Plan's dates, Active toggle and Workout tabs, above the selected
// Workout's Exercise Entries.
function PlanSettings({
  state, dateError, onSetDates, onSelect, onChanged
}: {
  state: EditorState;
  dateError: string | undefined;
  onSetDates: (write: () => void) => void;
  onSelect: (workoutId: string | undefined) => void;
  onChanged: () => void;
}) {
  const colors = useThemeColors();

  const {
    plan, workouts, workout
  } = state;

  return (
    <>
      <PlanDates plan={plan}
        error={dateError}
        onSetDates={onSetDates} />
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
        onReorder={ids => saveOrder(() => reorderWorkouts(plan.id, ids), onChanged)}
        onAdd={() => onSelect(createNextDayWorkout(plan.id).id)} />
    </>
  );
}

// Editing a Plan on one page, every change saved straight away. A new Plan is
// made with the New plan form first, then opens here.
export function PlanEditor({ planId }: { planId: string }) {
  const [ workoutId, setWorkoutId ] = useState<string>();
  const [ state, setState ] = useState(() => loadEditor(planId, workoutId));
  const [ name, setName ] = useState(state ? state.plan.name : "");
  // Why the name last typed wasn't saved (e.g. it's empty): shown only once
  // editing ends, not while the lifter is mid-way through retyping it.
  const unsavedName = useRef<string>(undefined);
  const [ nameError, setNameError ] = useState<string>();
  const [ dateError, setDateError ] = useState<string>();
  // The Exercise Entry whose editor is open, and the last edit that failed.
  const [ editingId, setEditingId ] = useState<string>();
  const [ editError, setEditError ] = useState<EditError>();
  // The Exercise Entries just removed together, while their Undo shows.
  const [ removed, setRemoved ] = useState<{ removals: ExerciseEntryRemoval[]; message: string }>();
  const tapOutside = useTapOutside(() => setEditingId(undefined));
  // While a row or tab is dragged, the editor holds still.
  const [ dragging, setDragging ] = useState(false);
  // Re-read on focus, coming back from the exercise picker, and
  // whenever the Plan is saved or another Workout is selected.
  const refresh = useCallback(() => setState(loadEditor(planId, workoutId)), [ planId, workoutId ]);

  useFocusEffect(refresh);

  const workout = state ? state.workout : undefined;
  const blocks = useMemo(() => (state ? state.blocks : []), [ state ]);
  const unit = state ? state.unit : undefined;
  const selection = useRowSelection(blocks, `${planId}/${workout?.id}`);

  // Saves an edit to an Exercise Entry or Superset, showing why it didn't
  // save on it.
  const edit = useCallback((on: Omit<EditError, "message">, write: () => void) => {
    const message = errorFrom(write);

    setEditError(message === undefined ? undefined : {
      ...on,
      message
    });
    refresh();
  }, [ refresh ]);

  const editing = useMemo((): EntryEditing => {
    const onEntry = (entry: { id: string }) => ({
      kind: "entry",
      id: entry.id
    }) as const;

    return {
      editingId,
      error: editError,
      onTap: entry => {
        setEditError(undefined);
        setEditingId(current => openRowAfterTap(current, entry.id));
      },
      onChange: (entry, changes) => edit(onEntry(entry), () => updateExerciseEntry(entry.id, changes)),
      // No confirmation: Undo shows instead.
      onRemove: entry => edit(onEntry(entry), () => {
        setRemoved({
          removals: deleteExerciseEntries([ entry.id ]),
          message: `Removed ${entry.exercise.name}`
        });
        setEditingId(undefined);
      }),
      onTouchInside: tapOutside.markInside
    };
  }, [
    editingId,
    editError,
    edit,
    tapOutside
  ]);

  const entryList = useMemo((): EntryList | undefined => unit && {
    unit,
    editing,
    selecting: selection.selecting
  }, [
    unit,
    editing,
    selection.selecting
  ]);

  // Saved on every change. Only the name changes, so the Plan is updated in
  // place rather than re-reading the whole editor.
  const changeName = (text: string) => {
    setName(text);

    unsavedName.current = errorFrom(() => {
      const plan = updatePlan(planId, { name: text });

      setState(current => current && {
        ...current,
        plan
      });
    });

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

  const openCalendar = () => router.push({
    pathname: "/plans/calendar/[id]",
    params: { id: planId }
  });

  // The calendar button shows for every saved Plan, as the progress summary
  // is hidden while there's nothing to report. Neither header action shows in
  // Select mode.
  const header = (
    <Stack.Screen options={{
      headerRight: state && !selection.selecting ?
        () => (
          <View className="flex-row items-center">
            <AppButton className="min-h-touch min-w-touch items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Plan calendar"
              onPress={openCalendar}>
              <AppIcon name="calendar-outline"
                color="accent"
                size={24} />
            </AppButton>
            <AppButton className="min-h-touch min-w-touch items-center justify-center"
              accessibilityRole="button"
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
          </View>
        ) :
        undefined
    }} />
  );

  if (!state) {
    return (
      <Screen>
        {header}
        <EmptyState icon="alert-circle-outline"
          message="This plan no longer exists." />
      </Screen>
    );
  }

  const undoRemove = (removals: ExerciseEntryRemoval[]) => {
    const message = errorFrom(() => restoreExerciseEntries(removals));

    setRemoved(undefined);
    refresh();

    if (message) {
      Alert.alert("Couldn't undo", message);
    }
  };

  const { selecting, tickedEntries } = selection;
  const tickedIds = tickedEntries.map(e => e.id);

  // Acts on the ticked rows, then leaves Select mode; a write that fails
  // says why and leaves the rows ticked.
  const actOnTicked = (write: () => void) => {
    const message = errorFrom(write);

    if (message) {
      Alert.alert("Couldn't change the exercises", message);
    } else {
      selection.stop();
    }

    refresh();
  };

  const removeTicked = () => actOnTicked(() => setRemoved({
    removals: deleteExerciseEntries(tickedIds),
    message: tickedEntries.length === 1 ? `Removed ${tickedEntries[ 0 ]!.exercise.name}` : `Removed ${tickedEntries.length} exercises`
  }));

  const addExercise = (blockId?: string) => router.push({
    pathname: "/workouts/add-exercise",
    params: {
      workoutId: workout!.id,
      ...(blockId && { blockId })
    }
  });

  // e.g. "Week 3 of 6 · 7 sessions done", under the title.
  const progressLine = formatPlanProgress(state.progress);

  const listHeader = (
    <View className="gap-4 py-4">
      <View className="gap-1">
        <TitleInput value={name}
          onChangeText={changeName}
          onEndEditing={endNameEditing} />
        {nameError && <AppText className="text-danger">{nameError}</AppText>}
        {progressLine && (
          <AppButton className="min-h-touch flex-row items-center gap-2 self-start"
            accessibilityRole="link"
            accessibilityHint="Show the plan calendar"
            onPress={openCalendar}>
            <AppIcon name="calendar-outline"
              color="accent"
              size={18} />
            <AppText className="text-muted">{progressLine}</AppText>
            <AppIcon name="chevron-forward"
              color="faint"
              size={16} />
          </AppButton>
        )}
      </View>
      <PlanSettings state={state}
        dateError={dateError}
        onSetDates={write => {
          setDateError(errorFrom(write));
          refresh();
        }}
        onSelect={id => {
          selection.stop();
          setWorkoutId(id);
        }}
        onChanged={refresh} />
      {blocks.length > 0 && (
        <AppButton variant="link"
          className="-my-2 self-end"
          accessibilityLabel={selecting ? "Done selecting" : "Select exercises"}
          onPress={selecting ? selection.stop : () => {
            setEditingId(undefined);
            selection.start();
          }}>
          {selecting ? "Done" : "Select"}
        </AppButton>
      )}
    </View>
  );

  return (
    <Screen {...tapOutside.handlers}>
      {header}
      <EntryListContext value={entryList}>
        <DragScrollContext value={setDragging}>
          <ScrollView scrollEnabled={!dragging}
            // Room for the selection bar over the last rows.
            contentContainerClassName={`px-4 ${selecting ? "pb-36" : "pb-4"}`}
            keyboardShouldPersistTaps="handled">
            {listHeader}
            {blocks.length > 0 ?
              (
                <DragList data={blocks}
                  keyOf={b => b.id}
                  gap={4}
                  enabled={!selecting}
                  onReorder={ids => saveOrder(() => reorderBlocks(workout!.id, ids), refresh)}
                  renderItem={block => (
                    <BlockItem block={block}
                      onSetRoundRest={restSeconds => edit({
                        kind: "superset",
                        id: block.id
                      }, () => setRoundRest(block.id, restSeconds))}
                      onReorderEntries={ids => saveOrder(() => reorderExerciseEntries(block.id, ids), refresh)}
                      onAddToSuperset={() => addExercise(block.id)} />
                  )} />
              ) :
              (
                <EmptyState icon="barbell-outline"
                  message={workout ? `No exercises in ${workout.name} yet.` : "No workouts yet. Tap + to add one."} />
              )}
            {workout && !selecting && (
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
            )}
          </ScrollView>
        </DragScrollContext>
      </EntryListContext>
      {selecting && (
        <SelectionBar count={tickedIds.length}
          canUngroup={selection.canUngroup}
          onCreateSuperset={() => actOnTicked(() => createSuperset(workout!.id, { exerciseEntryIds: tickedIds }))}
          onUngroup={() => actOnTicked(() => ungroupExerciseEntries(workout!.id, tickedIds))}
          onRemove={removeTicked} />
      )}
      {removed && (
        <Snackbar key={removed.removals[ 0 ]!.exerciseEntryId}
          message={removed.message}
          actionLabel="Undo"
          onAction={() => undoRemove(removed.removals)}
          onHide={() => setRemoved(undefined)} />
      )}
    </Screen>
  );
}
