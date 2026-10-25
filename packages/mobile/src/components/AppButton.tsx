import { forwardRef } from "react";
import { Pressable } from "react-native";
import type { PressableProps, View } from "react-native";

import { AppText } from "./AppText";

const VARIANT_BASE_CLASS = {
  primary: "items-center rounded-lg bg-brand-primary p-4 active:opacity-80 disabled:opacity-50",
  outline: "rounded-lg border border-brand-primary px-3 py-1 active:opacity-80",
  chip: "rounded-full border px-3 py-1",
  plain: ""
} as const;

const VARIANT_TEXT_CLASS = {
  primary: "text-brand-white",
  outline: "text-brand-primary",
  chip: "text-brand-darkGray",
  plain: "text-brand-darkGray"
} as const;

const VARIANT_TEXT_WEIGHT = {
  primary: "semibold",
  outline: "regular",
  chip: "regular",
  plain: "regular"
} as const;

type AppButtonVariant = keyof typeof VARIANT_BASE_CLASS;

interface AppButtonProps extends Omit<PressableProps, "children"> {
  variant?: AppButtonVariant;
  selected?: boolean;
  children?: React.ReactNode;
}

export const AppButton = forwardRef<View, AppButtonProps>(function AppButton(
  {
    variant = "plain", selected, className, children, ...props
  },
  ref
) {
  const selectedClass =
    variant === "chip" ?
      selected ? "border-brand-primary bg-brand-primaryLight" : "border-brand-lightGray" :
      "";

  return (
    <Pressable
      ref={ref}
      className={[
        VARIANT_BASE_CLASS[ variant ],
        selectedClass,
        className
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {typeof children === "string" ?
        (
          <AppText weight={VARIANT_TEXT_WEIGHT[ variant ]}
            className={VARIANT_TEXT_CLASS[ variant ]}>
            {children}
          </AppText>
        ) :
        children}
    </Pressable>
  );
});
