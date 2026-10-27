import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import { listAiChanges, undoAiChange } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { rowPosition, rowSurfaceClass } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { formatDateTime } from "@/format";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Changes by AI: every change the lifter's AI made through AI Access, newest
// first, each with Undo.
export default function AiChangesScreen() {
  const [ changes, setChanges ] = useState(() => listAiChanges());
  const [ error, setError ] = useState<string>();

  useFocusEffect(useCallback(() => setChanges(listAiChanges()), []));

  const undo = (id: string) => {
    try {
      undoAiChange(id);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }

    setChanges(listAiChanges());
  };

  return (
    <Screen>
      <FlatList
        data={changes}
        keyExtractor={c => c.id}
        contentContainerClassName="p-4"
        ListHeaderComponent={error ? <AppText className="pb-4 text-danger">{error}</AppText> : undefined}
        ListEmptyComponent={(
          <AppText className="text-muted">
            Changes your AI makes through AI Access show up here, each one undoable.
          </AppText>
        )}
        renderItem={({ item, index }) => (
          <View className={`flex-row items-center gap-3 px-4 py-3 ${rowSurfaceClass(rowPosition(index, changes.length))}`}>
            <View className="flex-1 gap-1">
              <AppText className={item.undoneAt ? "text-muted line-through" : "text-ink"}>
                {item.summary}
              </AppText>
              <AppText className="text-sm text-muted">
                {item.createdAt && formatDateTime(item.createdAt)}
                {item.undoneAt && ` · Undone ${formatDateTime(item.undoneAt)}`}
              </AppText>
            </View>
            {!item.undoneAt && (
              <AppButton variant="secondary"
                accessibilityLabel={`Undo: ${item.summary}`}
                onPress={() => undo(item.id)}>
                Undo
              </AppButton>
            )}
          </View>
        )}
    />
    </Screen>
  );
}
