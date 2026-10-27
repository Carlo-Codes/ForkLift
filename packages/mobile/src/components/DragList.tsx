import {
  createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef
} from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import type {
  AccessibilityActionEvent, AccessibilityActionInfo, LayoutChangeEvent
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { PanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AppIcon } from "./AppIcon";

import {
  dragEnd, dropIndex, moveItem, settleOffset, shiftOf
} from "@/dragOrder";

// How a drag, a scroll and a tap share an item (in points and milliseconds):
// - Lists scroll the same way their items are dragged, so an item lifts for
//   dragging only once held still for HOLD_TO_DRAG_MS; moving sooner scrolls,
//   and letting go sooner is a tap.
// - Let a lifted item go without moving TAP_SLOP and it's a hold release (the
//   list's onHoldRelease, if any), not a drop.
// - A finger that moves less than TAP_SLOP still counts as a tap.
export const HOLD_TO_DRAG_MS = 300;
export const TAP_SLOP = 10;

// How long the rows take to move out of the way, and the dropped row to settle.
const MOVE_MS = 150;

// Told when a drag starts and ends, so the scroll view that provides it holds
// still meanwhile. A provider inside another's scroll view (WorkoutTabs in the
// Plan editor) tells the outer one too.
export const DragScrollContext = createContext<(dragging: boolean) => void>(() => undefined);

// The item a DragArea drags, and its moves for screen readers.
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
  // Counts drags, so what's left of one (its settling, its drop) does nothing
  // once another has started.
  token: SharedValue<number>;
}

// The drag in progress, as the JS thread knows it.
interface Drag {
  key: string;
  token: number;
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
  // An item held and let go without moving: its long-press, if it has one.
  onHoldRelease?: (item: T) => void;
  enabled?: boolean;
}

// A list whose items are held and dragged into a new order: the others make
// way while an item is dragged, and onReorder saves the order it's dropped in.
// Each item is held from the DragArea it renders: the whole row, say, or only
// a Superset's header.
export function DragList<T>({
  data, keyOf, renderItem, onReorder, horizontal = false, gap = 0, onHoldRelease, enabled = true
}: DragListProps<T>) {
  const notifyScroll = use(DragScrollContext);

  const shared: DragShared = {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    offset: useSharedValue(0),
    sizes: useSharedValue<number[]>([]),
    wandered: useSharedValue(false),
    token: useSharedValue(0)
  };

  const sizes = useRef<number[]>([]);
  const drag = useRef<Drag>(undefined);
  // Read when a drag starts or ends, so the handlers stay the same.
  const notifyRef = useRef(notifyScroll);

  notifyRef.current = notifyScroll;
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

  // Ends the drag in progress if it's the one given (by its token, or by the
  // item's key when that item goes away), letting the scroll view move again.
  const end = useCallback((matches: (current: Drag) => boolean) => {
    if (!drag.current || !matches(drag.current)) {
      return false;
    }

    drag.current = undefined;
    notifyRef.current(false);

    return true;
  }, []);

  const handlers = useMemo((): DragHandlers => ({
    measure: (index, size) => {
      sizes.current[ index ] = size;
      shared.sizes.set([ ...sizes.current ]);
    },
    start: (key, token) => {
      drag.current = {
        key,
        token
      };
      notifyRef.current(true);
    },
    drop: (fromIndex, toIndex, token) => {
      if (end(d => d.token === token)) {
        move(fromIndex, toIndex);
      }
    },
    cancel: token => {
      if (end(d => d.token === token)) {
        reset();
      }
    },
    holdRelease: (index, token) => {
      if (!end(d => d.token === token)) {
        return;
      }

      reset();

      const item = latest.current.data[ index ];

      if (item !== undefined) {
        latest.current.onHoldRelease?.(item);
      }
    },
    lost: key => {
      if (end(d => d.key === key)) {
        reset();
      }
    },
    move
  }), [
    shared.sizes,
    end,
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
          itemKey={keys[ index ]!}
          index={index}
          count={data.length}
          shared={shared}
          handlers={handlers}
          horizontal={horizontal}
          gap={gap}
          enabled={enabled}>
          {renderItem(item, index)}
        </DragItem>
      ))}
    </View>
  );
}

// What an item's gesture tells its list on the JS thread. A drag's token
// keeps a late call about an earlier drag from touching the one in progress.
interface DragHandlers {
  measure: (index: number, size: number) => void;
  start: (key: string, token: number) => void;
  drop: (from: number, to: number, token: number) => void;
  cancel: (token: number) => void;
  holdRelease: (index: number, token: number) => void;
  // The item went away (e.g. a refresh removed it), mid-drag or not.
  lost: (key: string) => void;
  move: (from: number, to: number) => void;
}

interface DragItemProps {
  itemKey: string;
  index: number;
  count: number;
  shared: DragShared;
  handlers: DragHandlers;
  horizontal: boolean;
  gap: number;
  enabled: boolean;
  children: ReactNode;
}

function DragItem({
  itemKey, index, count, shared, handlers, horizontal, gap, enabled, children
}: DragItemProps) {
  const {
    from, to, offset, sizes, wandered, token
  } = shared;

  // Passed back to the JS thread from the gesture's worklets.
  const {
    start, drop, cancel, holdRelease, lost
  } = handlers;

  // An item removed mid-drag takes its gesture with it, so nothing else would
  // end the drag and let the scroll view move again.
  useEffect(() => () => lost(itemKey), [ lost, itemKey ]);

  const pan = usePanGesture({
    enabled,
    activateAfterLongPress: HOLD_TO_DRAG_MS,
    onActivate: () => {
      "worklet";

      token.set(token.get() + 1);
      from.set(index);
      to.set(index);
      offset.set(0);
      wandered.set(false);
      scheduleOnRN(start, itemKey, token.get());
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
    onDeactivate: event => {
      "worklet";

      const current = token.get();

      const end = dragEnd({
        canceled: event.canceled,
        wandered: wandered.get()
      });

      // Interrupted (e.g. by the system): back to where it was, unchanged.
      if (end === "cancel") {
        offset.set(withTiming(0, { duration: MOVE_MS }, finished => {
          if (finished && token.get() === current) {
            scheduleOnRN(cancel, current);
          }
        }));

        return;
      }

      if (end === "holdRelease") {
        scheduleOnRN(holdRelease, index, current);

        return;
      }

      const target = to.get();

      // Settling is cut short when another drag starts; that one carries on.
      offset.set(withTiming(settleOffset(sizes.get(), index, target), { duration: MOVE_MS }, finished => {
        if (finished && token.get() === current) {
          scheduleOnRN(drop, index, target, current);
        }
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
        {children}
      </Animated.View>
    </DragItemContext>
  );
}

// The moves a screen reader offers on the item being dragged by this element:
// up / down (left / right) one place.
export function useDragActions(): Pick<DragItemValue, "actions" | "onAction"> | undefined {
  return use(DragItemContext);
}

// Where the item around it is held to drag: all of it, or a part (a
// Superset's header). Taps inside still work, and moving before the hold
// scrolls the list. Screen readers move the item with useDragActions instead.
export function DragArea({ children }: { children: ReactNode }) {
  const item = use(DragItemContext);

  if (!item) {
    throw new Error("DragArea must be used inside a DragList item");
  }

  return (
    <GestureDetector gesture={item.gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}

// The grip drawn on an item that's held to drag. It's a hint only: the hold
// starts anywhere on the item's DragArea. Screen readers skip it.
export function DragHandle() {
  return (
    <View className="min-h-touch min-w-touch items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AppIcon name="reorder-three"
        color="faint"
        size={22} />
    </View>
  );
}
