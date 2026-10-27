import { renumber } from "../position";

describe("renumber", () => {
  it("numbers rows 0..n-1 in the order given, keeping only those whose position changes", () => {
    expect(renumber([
      {
        id: "a",
        position: 0
      },
      {
        id: "c",
        position: 2
      },
      {
        id: "b",
        position: 1
      },
      {
        id: "d",
        position: 3
      }
    ])).toEqual([
      {
        id: "c",
        position: 1
      },
      {
        id: "b",
        position: 2
      }
    ]);
  });

  it("closes gaps", () => {
    expect(renumber([
      {
        id: "a",
        position: 0
      },
      {
        id: "b",
        position: 5
      }
    ])).toEqual([
      {
        id: "b",
        position: 1
      }
    ]);
  });

  it("keeps nothing for rows already in place", () => {
    expect(renumber([
      {
        id: "a",
        position: 0
      },
      {
        id: "b",
        position: 1
      }
    ])).toEqual([]);
  });
});
