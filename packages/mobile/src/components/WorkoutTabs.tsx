import {
  useEffect, useRef, useState
} from "react";
import {
  Alert, ScrollView, View
} from "react-native";
import type { ScrollViewInstance, TextInputInstance } from "react-native";

import type { WorkoutAttributes } from "@forklift/db/client";

import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { Chip } from "./Chip";

import { errorMessage } from "@/errorMessage";

interface WorkoutTabsProps {
  workouts: Pick<WorkoutAttributes, "id" | "name">[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  // Throws (e.g. a ValidationError) to keep the old name, with the message shown.
  onRename: (id: string, name: string) => void;
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
      className="min-w-24"
      value={name}
      onChangeText={setName}
      selectTextOnFocus
      returnKeyType="done"
      accessibilityLabel="Workout name"
      onEndEditing={() => onDone(name)} />
  );
}

// The Plan's Workouts as a row of tabs that scrolls sideways. Tap to switch,
// long-press to rename or delete, "+" to add the next "Day N".
export function WorkoutTabs({
  workouts, selectedId, onSelect, onRename, onDelete, onAdd
}: WorkoutTabsProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [ renamingId, setRenamingId ] = useState<string>();
  const [ error, setError ] = useState<string>();
  const shownCount = useRef(workouts.length);

  // A Workout added with "+" is at the end: bring it into view.
  useEffect(() => {
    if (workouts.length > shownCount.current) {
      scrollRef.current?.scrollToEnd();
    }

    shownCount.current = workouts.length;
  }, [ workouts.length ]);

  const rename = (id: string, name: string) => {
    setRenamingId(undefined);

    try {
      onRename(id, name);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const confirmDelete = (workout: Pick<WorkoutAttributes, "id" | "name">) => Alert.alert(
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

  const showActions = (workout: Pick<WorkoutAttributes, "id" | "name">) => Alert.alert(workout.name, undefined, [
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
      <ScrollView ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2"
        accessibilityRole="tablist">
        {workouts.map(workout => {
          if (workout.id === renamingId) {
            return (
              <RenameField key={workout.id}
                initial={workout.name}
                onDone={name => rename(workout.id, name)} />
            );
          }

          const selected = workout.id === selectedId;

          return (
            <Chip key={workout.id}
              selected={selected}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityHint="Long-press to rename or delete"
              onPress={() => onSelect(workout.id)}
              onLongPress={() => showActions(workout)}>
              {workout.name}
            </Chip>
          );
        })}
        <Chip icon="add"
          accessibilityRole="button"
          accessibilityLabel="Add workout"
          onPress={onAdd} />
      </ScrollView>
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}
