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

  describe("From and To dates", () => {
    it("has no dates unless the lifter sets them", () => {
      expect(createPlan({ name: "PPL" })).toEqual(expect.objectContaining({
        startDate: null,
        endDate: null
      }));
    });

    it("saves a Plan's dates as calendar days", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      expect(getPlan(id)).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
    });

    it("allows a Plan to start and end on the same day, or set only one date", () => {
      expect(createPlan({
        name: "A",
        startDate: "2026-11-02",
        endDate: "2026-11-02"
      }).endDate).toBe("2026-11-02");
      expect(createPlan({
        name: "B",
        endDate: "2026-11-02"
      }).startDate).toBeNull();
    });

    it("rejects a To date before the From date and adds nothing", () => {
      expect(() => createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-11-01"
      })).toThrow(validationError);
      expect(listPlans()).toEqual([]);
    });

    it("rejects a date that isn't a calendar day", () => {
      for (const date of [
        "2026-02-30",
        "02/11/2026",
        "2026-11-02T00:00:00Z",
        ""
      ]) {
        expect(() => createPlan({
          name: "PPL",
          startDate: date
        })).toThrow(validationError);
      }
    });

    it("changes one date, keeps the other, and clears one set to null", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      updatePlan(id, { endDate: "2027-01-03" });

      expect(getPlan(id)).toEqual(expect.objectContaining({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2027-01-03"
      }));

      updatePlan(id, { startDate: null });

      expect(getPlan(id).startDate).toBeNull();
      expect(getPlan(id).endDate).toBe("2027-01-03");
    });

    it("rejects an edit that puts To before the From date already saved", () => {
      const { id } = createPlan({
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });

      expect(() => updatePlan(id, { endDate: "2026-11-01" })).toThrow(validationError);
      expect(() => updatePlan(id, { startDate: "2026-12-28" })).toThrow(validationError);
      expect(getPlan(id)).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
    });

    it("doesn't change which Plan is Active", () => {
      const current = createPlan({ name: "Current" });
      const ended = createPlan({
        name: "Ended",
        startDate: "2020-01-01",
        endDate: "2020-02-01"
      });
      const upcoming = createPlan({
        name: "Upcoming",
        startDate: "2099-01-01"
      });

      setActivePlan(ended.id);
      updatePlan(upcoming.id, { startDate: "2000-01-01" });
      updatePlan(current.id, {
        startDate: "2000-01-01",
        endDate: "2099-01-01"
      });

      expect(getActivePlan()?.id).toBe(ended.id);
    });
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
