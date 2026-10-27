import { View } from "react-native";
import type { ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Edge = "top" | "bottom" | "left" | "right";

interface ScreenProps extends ViewProps {
  // The header covers the top inset, so by default only the others are kept
  // clear. A screen without a header adds "top".
  edges?: readonly Edge[];
}

const BELOW_HEADER: readonly Edge[] = [
  "bottom",
  "left",
  "right"
];

// The root of every screen: the theme background, with content kept clear of
// the system bars and home indicator (the app draws edge to edge). className
// and style lay out the content inside the insets.
export function Screen({
  edges = BELOW_HEADER, className, ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inset = (edge: Edge) => (edges.includes(edge) ? insets[ edge ] : 0);

  return (
    <View className="flex-1 bg-background"
      style={{
        paddingTop: inset("top"),
        paddingBottom: inset("bottom"),
        paddingLeft: inset("left"),
        paddingRight: inset("right")
      }}>
      <View className={`flex-1${className ? ` ${className}` : ""}`}
        {...props} />
    </View>
  );
}
