import debug from "debug";

import { createDebugger } from "..";

// Tests run in file order within a describe block, which this relies on: the
// module-level "has this process already enabled ForkLift:*" flag in createDebugger
// only flips once, so the "off" case must run before the "on" case.
describe("createDebugger", () => {
  const originalEnvironment = process.env.ENVIRONMENT;

  afterAll(() => {
    process.env.ENVIRONMENT = originalEnvironment;
  });

  it("returns log, error and info debuggers", () => {
    const result = createDebugger("Shape");

    expect(typeof result.log).toBe("function");
    expect(typeof result.error).toBe("function");
    expect(typeof result.info).toBe("function");
  });

  it("does not enable ForkLift:* output unless ENVIRONMENT=development", () => {
    delete process.env.ENVIRONMENT;

    createDebugger("GateOff");

    expect(debug.enabled("ForkLift:GateOff:")).toBe(false);
  });

  it("enables ForkLift:* output once ENVIRONMENT=development", () => {
    process.env.ENVIRONMENT = "development";

    createDebugger("GateOn");

    expect(debug.enabled("ForkLift:GateOn:")).toBe(true);
  });
});
