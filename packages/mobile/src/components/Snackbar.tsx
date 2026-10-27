import { useEffect, useRef } from "react";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { Card } from "./Card";

const SHOWN_MS = 5000;

interface SnackbarProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  // After a few seconds without the action. Give the Snackbar a new key to
  // show it afresh, timer and all.
  onHide: () => void;
}

// A brief message at the bottom of the screen with one action, e.g. Undo after
// removing an Exercise Entry. Place it last in a Screen, over the content.
export function Snackbar({
  message, actionLabel, onAction, onHide
}: SnackbarProps) {
  const hide = useRef(onHide);

  hide.current = onHide;

  useEffect(() => {
    const timer = setTimeout(() => hide.current(), SHOWN_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="absolute bottom-4 left-4 right-4 flex-row items-center gap-2 border border-separator pl-4"
      accessibilityLiveRegion="polite">
      <AppText className="flex-1 text-ink">{message}</AppText>
      <AppButton variant="link"
        onPress={onAction}>
        {actionLabel}
      </AppButton>
    </Card>
  );
}
