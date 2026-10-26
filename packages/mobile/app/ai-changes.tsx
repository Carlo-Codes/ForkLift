import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";

import { listAiChanges, undoAiChange } from "@forklift/core";

import { AppButton } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
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
    <FlatList
      className="flex-1 bg-brand-white"
      data={changes}
      keyExtractor={c => c.id}
      ListHeaderComponent={error ? <AppText className="px-4 pt-4 text-brand-error">{error}</AppText> : undefined}
      ListEmptyComponent={(
        <AppText className="p-4 text-brand-mediumGray">
          Changes your AI makes through AI Access show up here, each one undoable.
        </AppText>
      )}
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 border-b border-brand-lighterGray px-4 py-4">
          <View className="flex-1 gap-1">
            <AppText className={item.undoneAt ? "text-brand-mediumGray line-through" : "text-brand-darkGray"}>
              {item.summary}
            </AppText>
            <AppText className="text-sm text-brand-mediumGray">
              {item.createdAt && formatDateTime(item.createdAt)}
              {item.undoneAt && ` · Undone ${formatDateTime(item.undoneAt)}`}
            </AppText>
          </View>
          {!item.undoneAt && (
            <AppButton variant="outline"
              accessibilityLabel={`Undo: ${item.summary}`}
              onPress={() => undo(item.id)}>
              Undo
            </AppButton>
          )}
        </View>
      )}
    />
  );
}
