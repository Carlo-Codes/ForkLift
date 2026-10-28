import {
  createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState
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
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import { AppIcon } from "./AppIcon";

import {
  dragEnd, dropIndex, dropLanded, moveItem, restAfterDrop, settleOffset, shiftOf
} from "@/dragOrder";
import type { PendingDrop, RestOffsets } from "@/dragOrder";

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
  // Where each item's transform rests, as the UI thread knows it.
  rest: SharedValue<RestOffsets>;
}

// The drag in progress, as the JS thread knows it.
interface Drag {
  key: string;
  token: number;
}

// A drop waiting for the list to show its order, and the drag it ends.
interface Drop extends PendingDrop {
  from: number;
  to: number;
  token: number;
}

interface DragListProps<T> {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  // The keys in their new order, once an item is dropped somewhere new. It
  // re-renders the list straight away, in the new order or, if it couldn't be
  // saved, the old.
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
//
// A drop must not move anything on screen when the list re-renders in the new
// order. React commits that order with the items' animated transforms still
// applied (Reanimated re-applies them to every React commit, and holds its own
// updates until that commit is mounted), so resetting the transforms then
// would draw each moved item a second slot away for a frame. Instead the
// transforms stay where the drop left them, and each item's inner view undoes
// its rest offset (RestOffsets), which changes in that same commit.
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
    token: useSharedValue(0),
    rest: useSharedValue<RestOffsets>({})
  };

  const sizes = useRef<number[]>([]);
  const drag = useRef<Drag>(undefined);
  // Read when a drag starts or ends, so the handlers stay the same.
  const notifyRef = useRef(notifyScroll);

  notifyRef.current = notifyScroll;

  // The rest offsets the items are drawn with, and the drop the next render
  // shows, if any.
  const [ rest, setRest ] = useState<RestOffsets>({});
  const [ drop, setDrop ] = useState<Drop>();
  const keys = data.map(keyOf);
  const landed = drop !== undefined && dropLanded(drop, keys);
  const shownRest = landed ? drop.rest : rest;

  const latest = useRef({
    data,
    keys,
    rest,
    onReorder,
    onHoldRelease
  });

  latest.current = {
    data,
    keys,
    rest,
    onReorder,
    onHoldRelease
  };

  const {
    from, to, offset, token, sizes: sharedSizes, rest: sharedRest
  } = shared;

  // What the end of a drag does on the UI thread. Each acts only while its
  // drag is the latest, so it leaves one started since alone.
  const ui = useMemo(() => ({
    // Nothing dragged: every item where its transform rests.
    reset: (current: number) => {
      "worklet";

      if (token.get() === current) {
        from.set(-1);
        to.set(-1);
        offset.set(0);
      }
    },
    // The list shows a drop's order: its items' sizes in that order and its
    // rest offsets take over from the drag, all in one go. Nothing moves, as
    // each transform stays where it is.
    land: (next: RestOffsets, nextSizes: number[], current: number) => {
      "worklet";

      sharedSizes.set(nextSizes);
      sharedRest.set(next);

      if (token.get() === current) {
        from.set(-1);
        to.set(-1);
        offset.set(0);
      }
    },
    // A drop the list doesn't show (it couldn't be saved): the dropped item
    // and the ones that made way glide back.
    goBack: (current: number) => {
      "worklet";

      if (token.get() !== current) {
        return;
      }

      to.set(from.get());

      offset.set(withTiming(0, { duration: MOVE_MS }, finished => {
        if (finished && token.get() === current) {
          from.set(-1);
          to.set(-1);
        }
      }));
    }
  }), [
    from,
    to,
    offset,
    token,
    sharedSizes,
    sharedRest
  ]);

  // Items removed since are no longer measured.
  useLayoutEffect(() => {
    if (sizes.current.length > latest.current.keys.length) {
      sizes.current.length = latest.current.keys.length;
      shared.sizes.set([ ...sizes.current ]);
    }
  });

  // The first render after a drop shows what onReorder saved: the new order,
  // or the old one again if it couldn't be saved.
  useLayoutEffect(() => {
    if (!drop) {
      return;
    }

    setDrop(undefined);

    if (landed) {
      setRest(drop.rest);
      sizes.current = moveItem(sizes.current, drop.from, drop.to);
      scheduleOnUI(ui.land, drop.rest, [ ...sizes.current ], drop.token);
    } else {
      scheduleOnUI(ui.goBack, drop.token);
    }
  }, [
    drop,
    landed,
    ui
  ]);

  // Ends the drag in progress if it's the one given (by its token, or by the
  // item's key when that item goes away), letting the scroll view move again.
  const end = useCallback((matches: (current: Drag) => boolean) => {
    const current = drag.current;

    if (!current || !matches(current)) {
      return undefined;
    }

    drag.current = undefined;
    notifyRef.current(false);

    return current;
  }, []);

  const handlers = useMemo((): DragHandlers => ({
    measure: (index, size) => {
      sizes.current[ index ] = size;
      shared.sizes.set([ ...sizes.current ]);
    },
    start: (key, current) => {
      drag.current = {
        key,
        token: current
      };
      notifyRef.current(true);
    },
    drop: (key, toIndex, current) => {
      if (!end(d => d.token === current)) {
        return;
      }

      const { keys: order, rest: now } = latest.current;
      const fromIndex = order.indexOf(key);

      if (fromIndex < 0 || fromIndex === toIndex || toIndex < 0 || toIndex >= order.length) {
        scheduleOnUI(ui.reset, current);

        return;
      }

      const next = moveItem(order, fromIndex, toIndex);

      // Batched with the re-render onReorder causes, so that render has it.
      setDrop({
        order: next,
        rest: restAfterDrop(now, order, sizes.current, fromIndex, toIndex),
        from: fromIndex,
        to: toIndex,
        token: current
      });

      try {
        latest.current.onReorder(next);
      } catch (e) {
        setDrop(undefined);
        scheduleOnUI(ui.goBack, current);
        throw e;
      }
    },
    cancel: current => {
      if (end(d => d.token === current)) {
        scheduleOnUI(ui.reset, current);
      }
    },
    holdRelease: (index, current) => {
      if (!end(d => d.token === current)) {
        return;
      }

      scheduleOnUI(ui.reset, current);

      const item = latest.current.data[ index ];

      if (item !== undefined) {
        latest.current.onHoldRelease?.(item);
      }
    },
    lost: key => {
      const ended = end(d => d.key === key);

      if (ended) {
        scheduleOnUI(ui.reset, ended.token);
      }
    },
    // A screen reader's move: nothing was dragged, so the list just
    // re-renders in the new order.
    move: (fromIndex, toIndex) => {
      const order = latest.current.keys;

      if (fromIndex === toIndex || toIndex < 0 || toIndex >= order.length) {
        return;
      }

      latest.current.onReorder(moveItem(order, fromIndex, toIndex));
    }
  }), [
    shared.sizes,
    end,
    ui
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
          restOffset={shownRest[ keys[ index ]! ] ?? 0}
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
  drop: (key: string, to: number, token: number) => void;
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
  // Where its transform rests, undone by its inner view.
  restOffset: number;
  shared: DragShared;
  handlers: DragHandlers;
  horizontal: boolean;
  gap: number;
  enabled: boolean;
  children: ReactNode;
}

function DragItem({
  itemKey, index, count, restOffset, shared, handlers, horizontal, gap, enabled, children
}: DragItemProps) {
  const {
    from, to, offset, sizes, wandered, token, rest
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

      // Interrupted (e.g. by the system): back to where it was, unchanged,
      // with the items that made way.
      if (end === "cancel") {
        to.set(index);

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
          scheduleOnRN(drop, itemKey, target, current);
        }
      }));
    }
  });

  const style = useAnimatedStyle(() => {
    const dragged = from.get() === index;
    const resting = rest.get()[ itemKey ] ?? 0;
    let moved = resting;

    if (dragged) {
      moved = resting + offset.get();
    } else if (from.get() >= 0) {
      moved = withTiming(resting + shiftOf(index, from.get(), to.get(), sizes.get()), { duration: MOVE_MS });
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
        {/* Undoes the rest offset, in the same commit as the order it's
            for. Never flattened, so its children aren't remounted when it
            first moves. */}
        <View collapsable={false}
          style={{ transform: [ horizontal ? { translateX: -restOffset } : { translateY: -restOffset } ] }}>
          {children}
        </View>
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
