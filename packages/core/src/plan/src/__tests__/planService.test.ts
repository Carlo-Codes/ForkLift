import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import {
  createPlan,
  getActivePlan,
  getPlan,
  listPlans,
  reorderPlans,
  setActivePlan,
  updatePlan
} from "..";

const validationError = expect.objectContaining({
  statusCode: 400,
  type: "ValidationError"
}) as ApiError;

const notFoundError = expect.objectContaining({
  statusCode: 404,
  type: "NotFoundError"
}) as ApiError;

describe("plans", () => {
  let teardown: () => void;

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("lists Plans in the order the lifter adds them, none Active", () => {
    createPlan({ name: "Push / Pull / Legs" });
    createPlan({ name: "  Upper / Lower " });

    expect(listPlans()).toEqual([
      expect.objectContaining({
        name: "Push / Pull / Legs",
        isActive: false
      }),
      expect.objectContaining({
        name: "Upper / Lower",
        isActive: false
      })
    ]);
  });

  it("rejects a Plan without a name and adds nothing", () => {
    expect(() => createPlan({ name: " " })).toThrow(validationError);
    expect(listPlans()).toEqual([]);
  });

  it("renames a Plan and rejects an empty name", () => {
    const { id } = createPlan({ name: "PPL" });

    updatePlan(id, { name: "Push / Pull / Legs" });

    expect(() => updatePlan(id, { name: "" })).toThrow(validationError);
    expect(getPlan(id).name).toBe("Push / Pull / Legs");
  });

  it("reports a missing Plan as not found", () => {
    const missingId = crypto.randomUUID();

    expect(() => getPlan(missingId)).toThrow(notFoundError);
    expect(() => updatePlan(missingId, { name: "PPL" })).toThrow(notFoundError);
  });

  it("reorders Plans", () => {
    const a = createPlan({ name: "A" });
    const b = createPlan({ name: "B" });
    const c = createPlan({ name: "C" });

    reorderPlans([
      c.id,
      a.id,
      b.id
    ]);

    expect(listPlans().map(p => p.name)).toEqual([
      "C",
      "A",
      "B"
    ]);
  });

  it("rejects an order that drops, repeats or invents a Plan", () => {
    const a = createPlan({ name: "A" });
    const b = createPlan({ name: "B" });

    expect(() => reorderPlans([ b.id ])).toThrow(validationError);
    expect(() => reorderPlans([ b.id, b.id ])).toThrow(validationError);
    expect(() => reorderPlans([ b.id, crypto.randomUUID() ])).toThrow(validationError);
    expect(listPlans().map(p => p.id)).toEqual([ a.id, b.id ]);
  });

  describe("Active Plan", () => {
    it("has no Active Plan until the lifter picks one", () => {
      createPlan({ name: "PPL" });

      expect(getActivePlan()).toBeUndefined();
    });

    it("keeps at most one Plan Active", () => {
      const ppl = createPlan({ name: "PPL" });
      const upperLower = createPlan({ name: "Upper / Lower" });

      setActivePlan(ppl.id);

      expect(getActivePlan()?.id).toBe(ppl.id);

      setActivePlan(upperLower.id);

      expect(getActivePlan()?.id).toBe(upperLower.id);
      expect(listPlans().filter(p => p.isActive)
        .map(p => p.id)).toEqual([ upperLower.id ]);
    });

    it("can be cleared", () => {
      const ppl = createPlan({ name: "PPL" });

      setActivePlan(ppl.id);
      setActivePlan(null);

      expect(getActivePlan()).toBeUndefined();
    });

    it("refuses a missing Plan and keeps the current one", () => {
      const ppl = createPlan({ name: "PPL" });

      setActivePlan(ppl.id);

      expect(() => setActivePlan(crypto.randomUUID())).toThrow(notFoundError);
      expect(getActivePlan()?.id).toBe(ppl.id);
    });
  });
});
