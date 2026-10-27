import { View } from "react-native";
import type { ViewProps } from "react-native";

// A rounded, borderless surface that groups related content or rows.
export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={`overflow-hidden rounded-2xl bg-surface${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
