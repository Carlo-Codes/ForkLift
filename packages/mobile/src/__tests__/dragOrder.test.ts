import { describe, expect, it } from "@jest/globals";

import {
  dropIndex, moveItem, settleOffset, shiftOf
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
