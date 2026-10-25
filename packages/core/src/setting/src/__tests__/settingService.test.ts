import type { Unit } from "@forklift/db/server";
import { setupTestDb } from "@forklift/db/server";
import { ApiError } from "@forklift/debug";

import { getSettings, setUnit } from "..";

describe("settings", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("defaults to kg before the lifter picks a unit", () => {
    const settings = getSettings();

    expect(settings.unit).toBe("kg");
  });

  it("keeps the unit the lifter picks", () => {
    setUnit("lb");

    expect(getSettings().unit).toBe("lb");

    setUnit("kg");

    expect(getSettings().unit).toBe("kg");
  });

  it("rejects a unit other than kg or lb and keeps the current one", () => {
    setUnit("lb");

    expect(() => setUnit("stone" as Unit)).toThrow(expect.objectContaining({
      statusCode: 400,
      type: "ValidationError"
    }) as ApiError);
    expect(getSettings().unit).toBe("lb");
  });
});
