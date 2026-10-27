import { describe, expect, it } from "@jest/globals";

import {
  dragEnd, dropIndex, dropLanded, moveItem, restAfterDrop, settleOffset, shiftOf
} from "../dragOrder";

// Four rows 50pt tall with a 10pt gap: each takes a 60pt slot, starting at
// 0, 60, 120 and 180, with their middles at 30, 90, 150 and 210.
const EVEN = [ 60, 60, 60, 60 ];

describe("dropIndex", () => {
  it("stays put until the dragged row's middle passes a neighbour's", () => {
    expect(dropIndex(EVEN, 1, 0)).toBe(1);
    expect(dropIndex(EVEN, 1, 59)).toBe(1);
    expect(dropIndex(EVEN, 1, -59)).toBe(1);
  });

  it("moves down past each row whose middle the dragged row's has passed", () => {
    expect(dropIndex(EVEN, 1, 61)).toBe(2);
    expect(dropIndex(EVEN, 1, 121)).toBe(3);
    expect(dropIndex(EVEN, 0, 1000)).toBe(3);
  });

  it("moves up the same way", () => {
    expect(dropIndex(EVEN, 2, -61)).toBe(1);
    expect(dropIndex(EVEN, 2, -1000)).toBe(0);
  });

  it("measures by the rows' own sizes, e.g. past a tall Superset", () => {
    // A 200pt Superset below a 60pt row: its middle is 130pt below the row's.
    expect(dropIndex([ 60, 200, 60 ], 0, 129)).toBe(0);
    expect(dropIndex([ 60, 200, 60 ], 0, 131)).toBe(1);
  });
});

describe("shiftOf", () => {
  it("moves the rows between where the dragged row was and where it is out of its way", () => {
    // Row 0 dragged down to 2: rows 1 and 2 move up one slot of the dragged row.
    expect([ 0, 1, 2, 3 ].map(i => shiftOf(i, 0, 2, [ 80, 60, 60, 60 ]))).toEqual([ 0, -80, -80, 0 ]);
    // Row 3 dragged up to 1: rows 1 and 2 move down.
    expect([ 0, 1, 2, 3 ].map(i => shiftOf(i, 3, 1, [ 60, 60, 60, 40 ]))).toEqual([ 0, 40, 40, 0 ]);
  });

  it("moves nothing while nothing is dragged or the row is back in its place", () => {
    expect(shiftOf(1, -1, -1, EVEN)).toBe(0);
    expect(shiftOf(1, 2, 2, EVEN)).toBe(0);
  });
});

describe("settleOffset", () => {
  it("is how far the dragged row's place moved: past the rows it went by", () => {
    expect(settleOffset([ 60, 200, 60 ], 0, 2)).toBe(260);
    expect(settleOffset([ 60, 200, 60 ], 2, 1)).toBe(-200);
    expect(settleOffset(EVEN, 1, 1)).toBe(0);
  });
});

describe("moveItem", () => {
  it("takes the item out and puts it in at the new index", () => {
    expect(moveItem([ "a", "b", "c", "d" ], 0, 2)).toEqual([ "b", "c", "a", "d" ]);
    expect(moveItem([ "a", "b", "c", "d" ], 3, 1)).toEqual([ "a", "d", "b", "c" ]);
    expect(moveItem([ "a", "b" ], 1, 1)).toEqual([ "a", "b" ]);
  });
});

// Where each item's slot starts along the list, by key.
const starts = (keys: string[], sizes: number[]) => {
  const start: Record<string, number> = {};
  let at = 0;

  keys.forEach((key, i) => {
    start[ key ] = at;
    at += sizes[ i ]!;
  });

  return start;
};

describe("restAfterDrop", () => {
  // The cause of the jank after a drop (#59): React commits the new order
  // with the transforms the settle left still applied, and resetting them
  // only reaches the screen a frame later, so every moved row jumps a second
  // slot and back. Instead the transforms stay put and each item's inner view
  // takes the new rest offset in the same commit as the new order, so the
  // re-render must draw every item exactly where the settle left it.
  it.each([
    [ "down past a tall Superset", 0, 2 ],
    [ "up to the top", 3, 0 ],
    [ "one place down", 1, 2 ]
  ])("draws every item where the settle left it once the list shows the new order: %s", (_, from, to) => {
    const keys = [ "a", "b", "c", "d" ];
    const sizes = [ 60, 200, 60, 90 ];
    // Offsets left by earlier drops.
    const rest: Record<string, number> = {
      a: 30,
      b: -60,
      c: 0,
      d: 120
    };

    const next = restAfterDrop(rest, keys, sizes, from, to);
    const before = starts(keys, sizes);
    const after = starts(moveItem(keys, from, to), moveItem(sizes, from, to));

    keys.forEach((key, index) => {
      // The settled drag draws each item at its slot moved by its transform
      // (its rest offset plus the drag's move), less its rest offset (undone
      // by the inner view).
      const moved = index === from ? settleOffset(sizes, from, to) : shiftOf(index, from, to, sizes);
      const transform = rest[ key ]! + moved;

      // The new order keeps the transform and undoes the new rest offset.
      expect(after[ key ]! + transform - next[ key ]!).toBe(before[ key ]! + transform - rest[ key ]!);
    });
  });

  it("drops the offsets of items no longer in the list", () => {
    expect(restAfterDrop({
      gone: 40,
      a: 10
    }, [ "a", "b" ], [ 60, 60 ], 0, 1)).toEqual({
      a: 70,
      b: -60
    });
  });
});

describe("dropLanded", () => {
  const pending = {
    order: [ "b", "a", "c" ],
    rest: {}
  };

  it("is true once the list shows the order the drop saved", () => {
    expect(dropLanded(pending, [ "b", "a", "c" ])).toBe(true);
  });

  it("is false while the list shows another order, e.g. the old one after a failed save", () => {
    expect(dropLanded(pending, [ "a", "b", "c" ])).toBe(false);
    expect(dropLanded(pending, [ "b", "a" ])).toBe(false);
  });
});

describe("dragEnd", () => {
  it("drops an item that was held and moved", () => {
    expect(dragEnd({
      canceled: false,
      wandered: true
    })).toBe("drop");
  });

  it("is a hold release when let go without moving, so nothing is reordered", () => {
    expect(dragEnd({
      canceled: false,
      wandered: false
    })).toBe("holdRelease");
  });

  it("puts the item back when the system interrupts the drag", () => {
    expect(dragEnd({
      canceled: true,
      wandered: true
    })).toBe("cancel");
    expect(dragEnd({
      canceled: true,
      wandered: false
    })).toBe("cancel");
  });
});
