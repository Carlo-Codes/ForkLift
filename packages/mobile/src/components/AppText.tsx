import { Text } from "react-native";
import type { TextProps } from "react-native";

const FONT_WEIGHT_CLASS = {
  regular: "font-Inter_Regular",
  semibold: "font-Inter_SemiBold"
} as const;

type FontWeight = keyof typeof FONT_WEIGHT_CLASS;

interface AppTextProps extends TextProps {
  weight?: FontWeight;
}

export function AppText({
  weight = "regular", className, ...props
}: AppTextProps) {
  return (
    <Text
      className={`${FONT_WEIGHT_CLASS[ weight ]}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
