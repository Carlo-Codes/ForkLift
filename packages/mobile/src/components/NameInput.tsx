import { useState } from "react";
import { View } from "react-native";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

interface NameInputProps {
  initial?: string;
  placeholder: string;
  submitLabel: string;
  // Clear the field after a successful submit (adding) or keep it (renaming).
  clearOnSubmit?: boolean;
  // Throws (e.g. a ValidationError from @forklift/core) to keep the typed name
  // with the message shown.
  onSubmit: (name: string) => void;
}

export function NameInput({
  initial = "", placeholder, submitLabel, clearOnSubmit, onSubmit
}: NameInputProps) {
  const [ name, setName ] = useState(initial);
  const [ error, setError ] = useState<string>();

  const submit = () => {
    try {
      onSubmit(name);
      setError(undefined);

      if (clearOnSubmit) {
        setName("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <AppTextInput
          className="flex-1"
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          returnKeyType="done"
        />
        <AppButton variant="secondary"
          onPress={submit}>
          {submitLabel}
        </AppButton>
      </View>
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}
