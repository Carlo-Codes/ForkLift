// The geometry of dragging an item along a list (Plan editor rows, Workout
// tabs). `sizes` are the items' slots along the drag axis, in order: each
// item's height (or width) plus the gap after it. These run on the UI thread
// while the finger moves, hence "worklet".

const sum = (sizes: number[], start: number, end: number) => {
  "worklet";

  let total = 0;

  for (let i = start; i < end; i++) {
    total += sizes[ i ] ?? 0;
  }

  return total;
};

// Where the item dragged from `from`, moved `offset` along the axis, would
// drop: past every other item whose middle its own middle has passed.
export function dropIndex(sizes: number[], from: number, offset: number): number {
  "worklet";

  const middle = sum(sizes, 0, from) + (sizes[ from ] ?? 0) / 2 + offset;
  let index = 0;

  for (let i = 0; i < sizes.length; i++) {
    if (i !== from && sum(sizes, 0, i) + (sizes[ i ] ?? 0) / 2 < middle) {
      index++;
    }
  }

  return index;
}

// How far an item that isn't dragged moves out of the way while the one from
// `from` would drop at `to`: one slot of the dragged item, up or down. Nothing
// moves while `from` is -1 (no drag).
export function shiftOf(index: number, from: number, to: number, sizes: number[]): number {
  "worklet";

  if (from < 0 || index === from) {
    return 0;
  }

  const size = sizes[ from ] ?? 0;

  if (from < index && index <= to) {
    return -size;
  }

  if (to <= index && index < from) {
    return size;
  }

  return 0;
}

// How far the dragged item's place moves when it drops at `to`: by the slots
// of the items it went past.
export function settleOffset(sizes: number[], from: number, to: number): number {
  "worklet";

  if (to === from) {
    return 0;
  }

  return to > from ? sum(sizes, from + 1, to + 1) : -sum(sizes, to, from);
}

// What letting go of a held item does: an item moved is dropped where it is,
// one let go without moving (TAP_SLOP) is a hold release, which reorders
// nothing, and one the system interrupted goes back unchanged.
export function dragEnd({ canceled, wandered }: { canceled: boolean; wandered: boolean }): "drop" | "holdRelease" | "cancel" {
  "worklet";

  if (canceled) {
    return "cancel";
  }

  return wandered ? "drop" : "holdRelease";
}

// The items in their new order, with the one at `from` moved to `to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [ ...items ];
  const [ moved ] = next.splice(from, 1);

  next.splice(to, 0, moved!);

  return next;
}

// Each item's rest offset, by key: where its animated transform sits while
// nothing is dragged. The item's inner view undoes it, so at rest the item is
// drawn in its place. A drop leaves the transforms where the settle put them
// and moves the inner views instead, as only those change in the same commit
// as the new order (see DragList).
export type RestOffsets = Record<string, number>;

// The rest offsets once the item at `from` is dropped at `to` and the list
// shows the new order: each item's grows by how far it moved on screen, the
// dropped one by its settle and the ones it passed by a slot of it. That is
// also how far its place moved, so the new order draws every item where it
// already was.
export function restAfterDrop(rest: RestOffsets, keys: string[], sizes: number[], from: number, to: number): RestOffsets {
  const next: RestOffsets = {};

  keys.forEach((key, index) => {
    const moved = index === from ? settleOffset(sizes, from, to) : shiftOf(index, from, to, sizes);

    next[ key ] = (rest[ key ] ?? 0) + moved;
  });

  return next;
}

// A drop waiting for the list to show it: the order it saved, and the rest
// offsets for that order.
export interface PendingDrop {
  order: string[];
  rest: RestOffsets;
}

// Whether the list shows the order a drop saved. One that couldn't be saved
// shows the old order again: it keeps the old rest offsets, and its items
// glide back.
export function dropLanded(pending: PendingDrop, keys: string[]): boolean {
  return pending.order.length === keys.length && pending.order.every((key, i) => key === keys[ i ]);
}
