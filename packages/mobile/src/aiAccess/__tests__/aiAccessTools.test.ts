import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  completeSet,
  createBlock,
  createExercise,
  createPlan,
  createWorkout,
  finishSession,
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

  it("offers only read tools", async () => {
    const { tools } = await client.listTools();

    expect(tools.map(t => t.name).sort()).toEqual([
      "get_exercise_history",
      "get_plan",
      "get_session",
      "get_workout",
      "list_plans",
      "list_sessions",
      "search_exercises"
    ]);
    expect(tools.every(t => t.annotations?.readOnlyHint === true)).toBe(true);
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

    it("lists Plans in order, marking the Active one", async () => {
      const { json } = await call("list_plans");

      expect(json()).toEqual([
        expect.objectContaining({
          id: planId,
          name: "Push / Pull",
          isActive: true
        }),
        expect.objectContaining({
          name: "Upper / Lower",
          isActive: false
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

  it.each([
    [ "get_plan", "planId" ],
    [ "get_workout", "workoutId" ],
    [ "get_session", "sessionId" ],
    [ "get_exercise_history", "exerciseId" ]
  ])("%s answers with an error for something that doesn't exist", async (name, key) => {
    const { isError, text } = await call(name, { [ key ]: MISSING_ID });

    expect(isError).toBe(true);
    expect(text).toMatch(/not found/);
  });

  it.each([
    [ "get_plan", {} ],
    [ "get_workout", { workoutId: "push" } ],
    [ "get_session", { sessionId: 42 } ],
    [ "search_exercises", { query: 7 } ]
  ])("%s rejects invalid input", async (name, args) => {
    const { isError, text } = await call(name, args);

    expect(isError).toBe(true);
    expect(text).toMatch(/validation/i);
  });
});
