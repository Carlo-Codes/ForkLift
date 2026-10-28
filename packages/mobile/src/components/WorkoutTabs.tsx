import {
  use, useCallback, useEffect, useRef, useState
} from "react";
import {
  Alert, ScrollView, View
} from "react-native";
import type { ScrollViewInstance, TextInputInstance } from "react-native";

import type { WorkoutAttributes } from "@forklift/db/client";

import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { Chip } from "./Chip";
import {
  DragArea, DragList, DragScrollContext, useDragActions
} from "./DragList";

import { errorMessage } from "@/errorMessage";

type Tab = Pick<WorkoutAttributes, "id" | "name">;

interface WorkoutTabsProps {
  workouts: Tab[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  // Throws (e.g. a ValidationError) to keep the old name, with the message shown.
  onRename: (id: string, name: string) => void;
  // The Workout ids in their new order; it shows why if they can't be saved,
  // the same way as the Plan editor's other drags.
  onReorder: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

// The tab being renamed: a field in place of its label, focused straight away.
function RenameField({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const ref = useRef<TextInputInstance>(null);
  const [ name, setName ] = useState(initial);

  useEffect(() => ref.current?.focus(), []);

  return (
    <AppTextInput ref={ref}
      className="min-w-[96px]"
      value={name}
      onChangeText={setName}
      selectTextOnFocus
      returnKeyType="done"
      accessibilityLabel="Workout name"
      onEndEditing={() => onDone(name)} />
  );
}

const TAB_ACTIONS = [
  {
    name: "rename",
    label: "Rename"
  },
  {
    name: "delete",
    label: "Delete"
  }
];

// One Workout's tab. A screen reader can't hold and let go, so it offers
// Rename and Delete as actions, along with moving the tab left and right.
function WorkoutTab({
  workout, selected, onSelect, onRename, onDelete
}: { workout: Tab; selected: boolean; onSelect: () => void; onRename: () => void; onDelete: () => void }) {
  const drag = useDragActions();

  return (
    <Chip selected={selected}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityHint="Hold to drag, or hold and let go to rename or delete"
      accessibilityActions={[ ...TAB_ACTIONS, ...(drag?.actions ?? []) ]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === "rename") {
          onRename();
        } else if (event.nativeEvent.actionName === "delete") {
          onDelete();
        } else {
          drag?.onAction(event);
        }
      }}
      onPress={onSelect}>
      {workout.name}
    </Chip>
  );
}

// The Plan's Workouts as a row of tabs that scrolls sideways. Tap to switch,
// "+" to add the next "Day N". Held still, a tab lifts: drag it to reorder,
// or let go for Rename and Delete. (Moving straight away scrolls the row,
// which runs the same way a tab is dragged.)
export function WorkoutTabs({
  workouts, selectedId, onSelect, onRename, onReorder, onDelete, onAdd
}: WorkoutTabsProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [ renamingId, setRenamingId ] = useState<string>();
  const [ error, setError ] = useState<string>();
  const [ dragging, setDragging ] = useState(false);
  const shownCount = useRef(workouts.length);
  const outerScroll = use(DragScrollContext);

  // Both this row and the editor around it hold still while a tab is dragged.
  const holdStill = useCallback((on: boolean) => {
    setDragging(on);
    outerScroll(on);
  }, [ outerScroll ]);

  // A Workout added with "+" is at the end: bring it into view.
  useEffect(() => {
    if (workouts.length > shownCount.current) {
      scrollRef.current?.scrollToEnd();
    }

    shownCount.current = workouts.length;
  }, [ workouts.length ]);

  const attempt = (write: () => void) => {
    try {
      write();
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const rename = (id: string, name: string) => {
    setRenamingId(undefined);
    attempt(() => onRename(id, name));
  };

  const confirmDelete = (workout: Tab) => Alert.alert(
    `Delete ${workout.name}?`,
    "Its exercises are removed from the plan. Past Sessions are kept.",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(workout.id)
      }
    ]
  );

  const showActions = (workout: Tab) => Alert.alert(workout.name, undefined, [
    {
      text: "Rename",
      onPress: () => setRenamingId(workout.id)
    },
    {
      text: "Delete",
      style: "destructive",
      onPress: () => confirmDelete(workout)
    },
    {
      text: "Cancel",
      style: "cancel"
    }
  ]);

  return (
    <View className="gap-1">
      <DragScrollContext value={holdStill}>
        <ScrollView ref={scrollRef}
          horizontal
          scrollEnabled={!dragging}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2"
          accessibilityRole="tablist">
          <DragList data={workouts}
            keyOf={w => w.id}
            horizontal
            gap={8}
            enabled={!renamingId}
            onReorder={onReorder}
            onHoldRelease={showActions}
            renderItem={workout => (workout.id === renamingId ?
              (
                <RenameField initial={workout.name}
                  onDone={name => rename(workout.id, name)} />
              ) :
              (
                <DragArea>
                  <WorkoutTab workout={workout}
                    selected={workout.id === selectedId}
                    onSelect={() => onSelect(workout.id)}
                    onRename={() => setRenamingId(workout.id)}
                    onDelete={() => confirmDelete(workout)} />
                </DragArea>
              ))} />
          <Chip icon="add"
            accessibilityRole="button"
            accessibilityLabel="Add workout"
            onPress={onAdd} />
        </ScrollView>
      </DragScrollContext>
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}
