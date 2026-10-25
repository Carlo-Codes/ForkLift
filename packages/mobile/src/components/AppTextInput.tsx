import { TextInput } from "react-native";
import type { TextInputProps } from "react-native";

export function AppTextInput({ className, ...props }: TextInputProps) {
  return (
    <TextInput
      className={`font-Inter_Regular${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
