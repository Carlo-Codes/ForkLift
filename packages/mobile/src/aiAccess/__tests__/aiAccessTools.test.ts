import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  completeSet,
  createBlock,
  createExercise,
  createPlan,
  createWorkout,
  finishSession,
  getCurrentStep,
  getSessionDetail,
  listAiChanges,
  listBlocks,
  listPlans,
  setActivePlan,
  setUnit,
  skipSet,
  startSession
} from "@forklift/core";
import { setupTestDb } from "@forklift/db/server";

import { createAiAccessMcpServer } from "../aiAccessTools";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

describe("AI Access tools", () => {
  let teardown: () => void;
  let client: Client;

  // A tool's JSON answer, or the message of the error it answered with.
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({
      name,
      arguments: args
    });
    const [ content ] = result.content as { type: string; text: string }[];

    return {
      isError: result.isError ?? false,
      text: content!.text,
      json: () => JSON.parse(content!.text) as unknown
    };
  };

  beforeEach(async () => {
    ({ teardown } = setupTestDb());

    const [ clientTransport, serverTransport ] = InMemoryTransport.createLinkedPair();

    client = new Client({
      name: "test",
      version: "1.0.0"
    });

    await createAiAccessMcpServer().connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    teardown();
  });

  it("offers read tools, and write tools only for Plans, Workouts and the Exercise Library", async () => {
    const { tools } = await client.listTools();
    const named = (readOnly: boolean) => tools.filter(t => (t.annotations?.readOnlyHint === true) === readOnly)
      .map(t => t.name)
      .sort();

    expect(named(true)).toEqual([
      "get_exercise_history",
      "get_plan",
      "get_session",
      "get_workout",
      "list_plans",
      "list_sessions",
      "search_exercises"
    ]);
    expect(named(false)).toEqual([
      "add_block",
      "add_to_superset",
      "create_exercise",
      "create_plan",
      "create_workout",
      "delete_block",
      "delete_exercise",
      "delete_exercise_entry",
      "delete_plan",
      "delete_workout",
      "group_superset",
      "rename_plan",
      "rename_workout",
      "reorder_blocks",
      "reorder_superset",
      "reorder_workouts",
      "set_plan_dates",
      "set_round_rest",
      "split_superset",
      "update_exercise",
      "update_exercise_entry"
    ]);
  });

  it("builds a Plan from scratch, each step a Change by AI", async () => {
    const plan = (await call("create_plan", { name: "PPL" })).json() as { id: string };
    const workout = (await call("create_workout", {
      planId: plan.id,
      name: "Push"
    })).json() as { id: string };
    const { id: exerciseId } = (await call("create_exercise", {
      name: "Landmine Press",
      muscleGroups: [ "shoulders" ],
      equipment: "barbell"
    })).json() as { id: string };
    const { id: flyId } = createExercise({
      name: "Cable Fly",
      muscleGroups: [ "chest" ]
    });
    const block = (await call("add_block", {
      workoutId: workout.id,
      exerciseId,
      targetSets: 4,
      targetReps: 8,
      targetWeight: 30
    })).json() as { id: string; exerciseEntries: { id: string }[] };

    await call("add_to_superset", {
      blockId: block.id,
      exerciseId: flyId
    });
    await call("update_exercise_entry", {
      exerciseEntryId: block.exerciseEntries[ 0 ]!.id,
      targetWeight: 32.5
    });
    await call("set_round_rest", {
      blockId: block.id,
      restSeconds: 60
    });

    const { json } = await call("get_workout", { workoutId: workout.id });

    expect(json()).toEqual(expect.objectContaining({
      name: "Push",
      blocks: [
        {
          id: block.id,
          exerciseEntries: [
            expect.objectContaining({
              exerciseName: "Landmine Press",
              targetSets: 4,
              targetReps: 8,
              targetWeight: 32.5,
              restSeconds: 60
            }),
            expect.objectContaining({
              exerciseName: "Cable Fly",
              restSeconds: 60
            })
          ]
        }
      ]
    }));
    expect(listAiChanges().map(c => c.summary)).toEqual([
      "Set the Round Rest of Landmine Press + Cable Fly in Workout \"Push\" to 60s",
      "Changed Landmine Press in Workout \"Push\": weight 30kg → 32.5kg",
      "Added Cable Fly to a Superset with Landmine Press in Workout \"Push\"",
      "Added Landmine Press to Workout \"Push\"",
      "Added \"Landmine Press\" to the Exercise Library",
      "Added Workout \"Push\" to Plan \"PPL\"",
      "Created Plan \"PPL\""
    ]);
  });

  describe("Plan dates", () => {
    it("creates a Plan with From and To dates, and reads them back", async () => {
      const { json } = await call("create_plan", {
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });
      const { id } = json() as { id: string };

      expect(json()).toEqual({
        id,
        name: "PPL",
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      });
      expect((await call("get_plan", { planId: id })).json()).toEqual(expect.objectContaining({
        startDate: "2026-11-02",
        endDate: "2026-12-27"
      }));
      expect((await call("list_plans")).json()).toEqual([
        expect.objectContaining({
          startDate: "2026-11-02",
          endDate: "2026-12-27"
        })
      ]);
    });

    it("sets one date, clears another, and leaves an omitted one alone, each a Change by AI", async () => {
      const { id: planId } = createPlan({
        name: "PPL",
        startDate: "2026-11-02"
      });

      await call("set_plan_dates", {
        planId,
        endDate: "2026-12-27"
      });
      await call("set_plan_dates", {
        planId,
        startDate: null
      });

      expect((await call("get_plan", { planId })).json()).toEqual(expect.objectContaining({
        startDate: null,
        endDate: "2026-12-27"
      }));
      expect(listAiChanges().map(c => c.summary)).toEqual([
        "Set Plan \"PPL\" to run until 2026-12-27",
        "Set Plan \"PPL\" to run from 2026-11-02 to 2026-12-27"
      ]);
    });

    it("answers dates out of order with the rule they break, changing nothing", async () => {
      const { id: planId } = createPlan({
        name: "PPL",
        startDate: "2026-11-02"
      });
      const { isError, text } = await call("set_plan_dates", {
        planId,
        endDate: "2026-11-01"
      });

      expect(isError).toBe(true);
      expect(text).toMatch(/on or after the From date/);
      expect(listPlans()[ 0 ]!.endDate).toBeNull();
      expect(listAiChanges()).toEqual([]);
    });

    it("answers a Plan longer than 52 weeks with the limit, creating or changing nothing", async () => {
      const created = await call("create_plan", {
        name: "Too long",
        startDate: "2026-10-27",
        endDate: "2027-10-26"
      });

      expect(created.isError).toBe(true);
      expect(created.text).toBe("A plan lasts at most 52 weeks, so its To date can be 2027-10-25 at the latest");
      expect(listPlans()).toEqual([]);

      const { id: planId } = createPlan({
        name: "PPL",
        startDate: "2026-10-27"
      });
      const set = await call("set_plan_dates", {
        planId,
        endDate: "2028-01-01"
      });

      expect(set.isError).toBe(true);
      expect(set.text).toMatch(/at most 52 weeks/);
      expect(listPlans()[ 0 ]!.endDate).toBeNull();
      expect(listAiChanges()).toEqual([]);

      await call("set_plan_dates", {
        planId,
        endDate: "2027-10-25"
      });

      expect(listPlans()[ 0 ]!.endDate).toBe("2027-10-25");
    });
  });

  describe("with a Plan and a finished Session", () => {
    let planId: string;
    let pushId: string;
    let pullId: string;
    let benchId: string;
    let rowId: string;
    let sessionId: string;

    beforeEach(() => {
      ({ id: planId } = createPlan({ name: "Push / Pull" }));
      createPlan({ name: "Upper / Lower" });
      ({ id: pushId } = createWorkout(planId, { name: "Push" }));
      ({ id: pullId } = createWorkout(planId, { name: "Pull" }));
      ({ id: benchId } = createExercise({
        name: "Bench Press",
        muscleGroups: [ "chest" ],
        equipment: "barbell"
      }));
      ({ id: rowId } = createExercise({
        name: "Barbell Row",
        muscleGroups: [ "back" ]
      }));
      createBlock(pushId, {
        exerciseId: benchId,
        targetSets: 2,
        targetReps: 8,
        targetWeight: 60
      });
      createBlock(pullId, { exerciseId: rowId });
      setActivePlan(planId);

      ({ id: sessionId } = startSession(pushId));
      completeSet(sessionId, { reps: 9 });
      skipSet(sessionId);
      finishSession(sessionId);
    });

    it("can't delete the Active Plan", async () => {
      const { isError, text } = await call("delete_plan", { planId });

      expect(isError).toBe(true);
      expect(text).toMatch(/Active Plan/);
      expect(listPlans().map(p => p.id)).toContain(planId);
    });

    it("leaves Sessions and their Logged Sets alone, whatever it writes", async () => {
      const { id: inProgressId } = startSession(pullId);
      const sessions = () => [ getSessionDetail(sessionId), getSessionDetail(inProgressId), getCurrentStep(inProgressId) ];
      const before = sessions();
      const [ push ] = listBlocks(pushId);
      const [ pull ] = listBlocks(pullId);

      const writes: [string, Record<string, unknown>][] = [
        [ "update_exercise_entry", {
          exerciseEntryId: push!.exerciseEntries[ 0 ]!.id,
          targetReps: 5
        } ],
        [ "update_exercise_entry", {
          exerciseEntryId: pull!.exerciseEntries[ 0 ]!.id,
          targetSets: 5
        } ],
        [ "update_exercise", {
          exerciseId: benchId,
          name: "Flat Bench Press"
        } ],
        [ "delete_exercise_entry", { exerciseEntryId: pull!.exerciseEntries[ 0 ]!.id } ],
        [ "delete_workout", { workoutId: pushId } ],
        [ "delete_exercise", { exerciseId: rowId } ]
      ];
      const results = [];

      for (const [ name, args ] of writes) {
        results.push(await call(name, args));
      }

      expect(results.filter(r => r.isError)).toEqual([]);
      expect(sessions()).toEqual(before);
    });

    it("lists Plans newest first, marking the Active one", async () => {
      const { json } = await call("list_plans");

      expect(json()).toEqual([
        expect.objectContaining({
          name: "Upper / Lower",
          isActive: false
        }),
        expect.objectContaining({
          id: planId,
          name: "Push / Pull",
          isActive: true
        })
      ]);
    });

    it("gets a Plan with its Workouts in order and the next one up", async () => {
      const { json } = await call("get_plan", { planId });

      expect(json()).toEqual(expect.objectContaining({
        id: planId,
        name: "Push / Pull",
        isActive: true,
        nextWorkoutId: pullId,
        workouts: [
          {
            id: pushId,
            name: "Push"
          },
          {
            id: pullId,
            name: "Pull"
          }
        ]
      }));
    });

    it("gets a Workout's Blocks with each Exercise Entry's targets, in the lifter's unit", async () => {
      const { json } = await call("get_workout", { workoutId: pushId });

      expect(json()).toEqual({
        id: pushId,
        planId,
        name: "Push",
        unit: "kg",
        blocks: [
          {
            id: expect.any(String) as string,
            exerciseEntries: [
              {
                id: expect.any(String) as string,
                exerciseId: benchId,
                exerciseName: "Bench Press",
                targetSets: 2,
                targetReps: 8,
                targetWeight: 60,
                restSeconds: expect.any(Number) as number,
                weightStep: 2.5
              }
            ]
          }
        ]
      });
    });

    it("searches the Exercise Library by name, or lists it all with no query", async () => {
      const found = await call("search_exercises", { query: "bench" });

      expect(found.json()).toEqual([
        {
          id: benchId,
          name: "Bench Press",
          muscleGroups: [ "chest" ],
          equipment: "barbell",
          notes: null
        }
      ]);

      const all = (await call("search_exercises")).json() as { name: string }[];

      expect(all.map(e => e.name)).toEqual(expect.arrayContaining([ "Bench Press", "Barbell Row" ]));
    });

    it("lists finished Sessions with their Workout", async () => {
      startSession(pullId);

      const { json } = await call("list_sessions");

      expect(json()).toEqual([
        expect.objectContaining({
          id: sessionId,
          workoutName: "Push",
          startedAt: expect.any(String) as string
        })
      ]);
    });

    it("lists only the Sessions started between two dates", async () => {
      const ids = async (args: Record<string, unknown>) => ((await call("list_sessions", args)).json() as { id: string }[])
        .map(s => s.id);

      expect(await ids({ from: "2000-01-01" })).toEqual([ sessionId ]);
      expect(await ids({ to: "2000-01-01" })).toEqual([]);
    });

    it("narrows an Exercise's history to a date range", async () => {
      const { json } = await call("get_exercise_history", {
        exerciseId: benchId,
        from: "2999-01-01"
      });

      expect(json()).toEqual(expect.objectContaining({ sessions: [] }));
    });

    it("answers a range that ends before it starts with the rule it breaks", async () => {
      const { isError, text } = await call("list_sessions", {
        from: "2026-10-03",
        to: "2026-10-02T12:00:00Z"
      });

      expect(isError).toBe(true);
      expect(text).toBe("The range must end on or after the day it starts");
    });

    it("gets a Session's Logged Sets, skipped ones marked, in the lifter's unit", async () => {
      setUnit("lb");

      const { json } = await call("get_session", { sessionId });

      expect(json()).toEqual(expect.objectContaining({
        id: sessionId,
        unit: "lb",
        blocks: [
          [
            expect.objectContaining({
              exerciseName: "Bench Press",
              sets: [
                expect.objectContaining({
                  reps: 9,
                  weight: 132.3,
                  skipped: false
                }),
                expect.objectContaining({ skipped: true })
              ]
            })
          ]
        ]
      }));
    });

    it("gets an Exercise's history with its Best Set", async () => {
      const { json } = await call("get_exercise_history", { exerciseId: benchId });

      expect(json()).toEqual(expect.objectContaining({
        unit: "kg",
        exercise: expect.objectContaining({ name: "Bench Press" }) as unknown,
        sessions: [
          expect.objectContaining({
            id: sessionId,
            sets: [ expect.objectContaining({ reps: 9 }) ]
          })
        ],
        bestSet: expect.objectContaining({
          reps: 9,
          weight: 60
        })
      }));
    });
  });

  it("answers with the rule a write breaks, such as a Plan without a name", async () => {
    const { isError, text } = await call("create_plan", { name: " " });

    expect(isError).toBe(true);
    expect(text).toBe("Name is required");
    expect(listAiChanges()).toEqual([]);
  });

  it.each([
    [ "get_plan", "planId" ],
    [ "get_workout", "workoutId" ],
    [ "get_session", "sessionId" ],
    [ "get_exercise_history", "exerciseId" ],
    [ "delete_workout", "workoutId" ],
    [ "update_exercise_entry", "exerciseEntryId" ]
  ])("%s answers with an error for something that doesn't exist", async (name, key) => {
    const { isError, text } = await call(name, { [ key ]: MISSING_ID });

    expect(isError).toBe(true);
    expect(text).toMatch(/not found/);
  });

  it.each([
    [ "get_plan", {} ],
    [ "get_workout", { workoutId: "push" } ],
    [ "get_session", { sessionId: 42 } ],
    [ "search_exercises", { query: 7 } ],
    [ "create_plan", { name: 7 } ],
    [ "reorder_blocks", { workoutId: MISSING_ID } ]
  ])("%s rejects invalid input", async (name, args) => {
    const { isError, text } = await call(name, args);

    expect(isError).toBe(true);
    expect(text).toMatch(/validation/i);
  });
});
