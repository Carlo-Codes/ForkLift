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

// The items in their new order, with the one at `from` moved to `to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [ ...items ];
  const [ moved ] = next.splice(from, 1);

  next.splice(to, 0, moved!);

  return next;
}
