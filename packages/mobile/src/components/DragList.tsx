import {
  createContext, use, useCallback, useLayoutEffect, useMemo, useRef
} from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import type {
  AccessibilityActionEvent, AccessibilityActionInfo, LayoutChangeEvent
} from "react-native";
import {
  GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture
} from "react-native-gesture-handler";
import type { PanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AppIcon } from "./AppIcon";

import {
  dropIndex, moveItem, settleOffset, shiftOf
} from "@/dragOrder";

// How a drag and a press share a row (all in points and milliseconds):
// - A drag handle starts a drag once the finger moves DRAG_SLOP, well inside
//   the ~10pt a scroll view waits before it scrolls, so the handle wins.
// - A handle held still for LONG_PRESS_MS is a long-press instead (React
//   Native's own long-press delay), as on the rest of the row.
// - A tab row scrolls sideways, the way its tabs are dragged, so a tab lifts
//   for dragging only once held still for HOLD_TO_DRAG_MS; moving sooner
//   scrolls. Let go without moving TAP_SLOP and it's a long-press.
// - A finger that moves less than TAP_SLOP still counts as a tap.
export const DRAG_SLOP = 4;
export const LONG_PRESS_MS = 500;
export const HOLD_TO_DRAG_MS = 300;
export const TAP_SLOP = 10;

// How long the rows take to move out of the way, and the dropped row to settle.
const MOVE_MS = 150;

// Told when a drag starts and ends, so the scroll view around the list holds
// still meanwhile. A list inside another passes it on to the outer one.
export const DragScrollContext = createContext<(dragging: boolean) => void>(() => undefined);

// The item a DragHandle drags, and its moves for screen readers.
interface DragItemValue {
  gesture: PanGesture;
  actions: AccessibilityActionInfo[];
  onAction: (event: AccessibilityActionEvent) => void;
}

const DragItemContext = createContext<DragItemValue | undefined>(undefined);

interface DragShared {
  // The index being dragged, or -1, and where it would drop.
  from: SharedValue<number>;
  to: SharedValue<number>;
  // How far the dragged item has moved along the list.
  offset: SharedValue<number>;
  // Each item's size along the list plus the gap after it.
  sizes: SharedValue<number[]>;
  // Whether the finger has moved TAP_SLOP since the drag started.
  wandered: SharedValue<boolean>;
}

interface DragListProps<T> {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  // The keys in their new order, once an item is dropped somewhere new. It
  // re-renders the list, in the new order or, if it couldn't be saved, the old.
  onReorder: (keys: string[]) => void;
  horizontal?: boolean;
  // Between items, in points.
  gap?: number;
  // "move": a DragHandle in each item drags it straight away. "hold": the
  // whole item drags once held still (for a list that scrolls the same way).
  startOn?: "move" | "hold";
  // An item held and let go without moving ("hold" lists): its long-press.
  onHoldRelease?: (item: T) => void;
  enabled?: boolean;
}

// A list whose items are dragged into a new order: the others make way while
// an item is dragged, and onReorder saves the order it's dropped in.
export function DragList<T>({
  data, keyOf, renderItem, onReorder, horizontal = false, gap = 0, startOn = "move", onHoldRelease, enabled = true
}: DragListProps<T>) {
  const notifyScroll = use(DragScrollContext);

  const shared: DragShared = {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    offset: useSharedValue(0),
    sizes: useSharedValue<number[]>([]),
    wandered: useSharedValue(false)
  };

  const sizes = useRef<number[]>([]);
  const keys = data.map(keyOf);

  const latest = useRef({
    data,
    keys,
    onReorder,
    onHoldRelease
  });

  latest.current = {
    data,
    keys,
    onReorder,
    onHoldRelease
  };

  // Set on a drop, so the items are put back once they're drawn in the new
  // order rather than jumping back first.
  const resetOnRender = useRef(false);

  const {
    from, to, offset
  } = shared;

  const reset = useCallback(() => {
    from.set(-1);
    to.set(-1);
    offset.set(0);
  }, [
    from,
    to,
    offset
  ]);

  // The first render after a drop shows what onReorder saved: the new order,
  // or the old one again if it couldn't be saved.
  useLayoutEffect(() => {
    // Items removed since are no longer measured.
    if (sizes.current.length > latest.current.keys.length) {
      sizes.current.length = latest.current.keys.length;
      shared.sizes.set([ ...sizes.current ]);
    }

    if (resetOnRender.current) {
      resetOnRender.current = false;
      reset();
    }
  });

  const move = useCallback((fromIndex: number, toIndex: number) => {
    const order = latest.current.keys;

    if (fromIndex === toIndex || toIndex < 0 || toIndex >= order.length) {
      reset();

      return;
    }

    resetOnRender.current = true;

    try {
      latest.current.onReorder(moveItem(order, fromIndex, toIndex));
    } catch (e) {
      resetOnRender.current = false;
      reset();
      throw e;
    }
  }, [ reset ]);

  const handlers = useMemo(() => ({
    measure: (index: number, size: number) => {
      sizes.current[ index ] = size;
      shared.sizes.set([ ...sizes.current ]);
    },
    start: () => notifyScroll(true),
    drop: (fromIndex: number, toIndex: number) => {
      notifyScroll(false);
      move(fromIndex, toIndex);
    },
    holdRelease: (index: number) => {
      notifyScroll(false);
      reset();

      const item = latest.current.data[ index ];

      if (item !== undefined) {
        latest.current.onHoldRelease?.(item);
      }
    },
    move
  }), [
    shared.sizes,
    notifyScroll,
    move,
    reset
  ]);

  return (
    <View
      style={{
        flexDirection: horizontal ? "row" : "column",
        gap
      }}>
      {data.map((item, index) => (
        <DragItem key={keys[ index ]}
          index={index}
          count={data.length}
          shared={shared}
          handlers={handlers}
          horizontal={horizontal}
          gap={gap}
          startOn={startOn}
          enabled={enabled}>
          {renderItem(item, index)}
        </DragItem>
      ))}
    </View>
  );
}

interface DragItemProps {
  index: number;
  count: number;
  shared: DragShared;
  handlers: {
    measure: (index: number, size: number) => void;
    start: () => void;
    drop: (from: number, to: number) => void;
    holdRelease: (index: number) => void;
    move: (from: number, to: number) => void;
  };
  horizontal: boolean;
  gap: number;
  startOn: "move" | "hold";
  enabled: boolean;
  children: ReactNode;
}

function DragItem({
  index, count, shared, handlers, horizontal, gap, startOn, enabled, children
}: DragItemProps) {
  const {
    from, to, offset, sizes, wandered
  } = shared;

  // Passed back to the JS thread from the gesture's worklets.
  const {
    start, drop, holdRelease
  } = handlers;

  const hold = startOn === "hold";

  // The worklets plugin can't take a spread in a gesture's config, so both
  // activation settings are always given, one of them undefined.
  const pan = usePanGesture({
    enabled,
    activateAfterLongPress: hold ? HOLD_TO_DRAG_MS : undefined,
    minDistance: hold ? undefined : DRAG_SLOP,
    onActivate: () => {
      "worklet";

      from.set(index);
      to.set(index);
      offset.set(0);
      wandered.set(false);
      scheduleOnRN(start);
    },
    onUpdate: event => {
      "worklet";

      const moved = horizontal ? event.translationX : event.translationY;

      offset.set(moved);
      to.set(dropIndex(sizes.get(), index, moved));

      if (Math.hypot(event.translationX, event.translationY) >= TAP_SLOP) {
        wandered.set(true);
      }
    },
    onDeactivate: () => {
      "worklet";

      if (hold && !wandered.get()) {
        scheduleOnRN(holdRelease, index);

        return;
      }

      const target = to.get();

      offset.set(withTiming(settleOffset(sizes.get(), index, target), { duration: MOVE_MS }, () => {
        scheduleOnRN(drop, index, target);
      }));
    }
  });

  const style = useAnimatedStyle(() => {
    const dragged = from.get() === index;
    let moved = 0;

    if (dragged) {
      moved = offset.get();
    } else if (from.get() >= 0) {
      moved = withTiming(shiftOf(index, from.get(), to.get(), sizes.get()), { duration: MOVE_MS });
    }

    return {
      transform: [ horizontal ? { translateX: moved } : { translateY: moved } ],
      zIndex: dragged ? 1 : 0,
      opacity: dragged ? 0.85 : 1
    };
  });

  const [ earlier, later ] = horizontal ? [ "Move left", "Move right" ] : [ "Move up", "Move down" ];

  const item = useMemo((): DragItemValue => ({
    gesture: pan,
    actions: [
      ...(index > 0 ? [
        {
          name: "earlier",
          label: earlier
        }
      ] : []),
      ...(index < count - 1 ? [
        {
          name: "later",
          label: later
        }
      ] : [])
    ],
    onAction: ({ nativeEvent }) => handlers.move(index, index + (nativeEvent.actionName === "earlier" ? -1 : 1))
  }), [
    pan,
    index,
    count,
    earlier,
    later,
    handlers
  ]);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;

    handlers.measure(index, (horizontal ? width : height) + gap);
  };

  return (
    <DragItemContext value={item}>
      <Animated.View style={style}
        onLayout={onLayout}>
        {startOn === "hold" ?
          (
            <GestureDetector gesture={pan}>
              <View>{children}</View>
            </GestureDetector>
          ) :
          children}
      </Animated.View>
    </DragItemContext>
  );
}

// The moves a screen reader offers on the item being dragged by this element:
// up / down (left / right) one place.
export function useDragActions(): Pick<DragItemValue, "actions" | "onAction"> | undefined {
  return use(DragItemContext);
}

// The grip that drags the item around it in a "move" list. Held still, it's
// a long-press instead (e.g. opening the row's editor).
export function DragHandle({ label, onLongPress }: { label: string; onLongPress?: () => void }) {
  const item = use(DragItemContext);

  if (!item) {
    throw new Error("DragHandle must be used inside a DragList item");
  }

  const longPress = useLongPressGesture({
    enabled: Boolean(onLongPress),
    minDuration: LONG_PRESS_MS,
    maxDistance: DRAG_SLOP,
    runOnJS: true,
    onActivate: () => onLongPress?.()
  });

  const gesture = useCompetingGestures(item.gesture, longPress);

  return (
    <GestureDetector gesture={gesture}>
      <View className="min-h-touch min-w-touch items-center justify-center"
        accessible
        accessibilityLabel={`Reorder ${label}`}
        accessibilityHint="Drag to move"
        accessibilityActions={item.actions}
        onAccessibilityAction={item.onAction}>
        <AppIcon name="reorder-three"
          color="faint"
          size={22} />
      </View>
    </GestureDetector>
  );
}
