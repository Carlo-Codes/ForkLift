import {
  useEffect, useRef, useState
} from "react";
import {
  Alert, Pressable, ScrollView, TextInput, View
} from "react-native";
import type { ScrollViewInstance, TextInputInstance } from "react-native";

import type { WorkoutAttributes } from "@forklift/db/client";

import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";

import { useThemeColors } from "@/theme";

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
  const colors = useThemeColors();
  const ref = useRef<TextInputInstance>(null);
  const [ name, setName ] = useState(initial);

  useEffect(() => ref.current?.focus(), []);

  return (
    <TextInput ref={ref}
      className="min-h-touch min-w-20 rounded-full bg-accent-soft px-4 font-Inter_SemiBold text-accent"
      value={name}
      onChangeText={setName}
      selectTextOnFocus
      selectionColor={colors.accent}
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
  const count = useRef(workouts.length);

  // A Workout added with "+" is at the end: bring it into view.
  useEffect(() => {
    if (workouts.length > count.current) {
      scrollRef.current?.scrollToEnd();
    }

    count.current = workouts.length;
  }, [ workouts.length ]);

  const rename = (id: string, name: string) => {
    setRenamingId(undefined);

    try {
      onRename(id, name);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
            <Pressable key={workout.id}
              className={`min-h-touch items-center justify-center rounded-full px-4 active:opacity-70 ${selected ? "bg-accent-soft" : "bg-fill"}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityHint="Long-press to rename or delete"
              onPress={() => onSelect(workout.id)}
              onLongPress={() => showActions(workout)}>
              <AppText weight={selected ? "semibold" : "regular"}
                className={selected ? "text-accent" : "text-ink"}>
                {workout.name}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable className="min-h-touch min-w-touch items-center justify-center rounded-full bg-fill active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Add workout"
          onPress={onAdd}>
          <AppIcon name="add"
            color="accent"
            size={22} />
        </Pressable>
      </ScrollView>
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}
