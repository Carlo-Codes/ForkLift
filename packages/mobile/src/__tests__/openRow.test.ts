import { describe, expect, it } from "@jest/globals";

import { openRowAfterTap } from "../openRow";

describe("openRowAfterTap", () => {
  it("opens a tapped row while none is open", () => {
    expect(openRowAfterTap(undefined, "a")).toBe("a");
  });

  it("moves the open editor to another tapped row, so one is open at a time", () => {
    expect(openRowAfterTap("a", "b")).toBe("b");
  });

  it("closes the open row when it's tapped again", () => {
    expect(openRowAfterTap("a", "a")).toBeUndefined();
  });
});
