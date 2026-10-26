import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  getExerciseHistory,
  getPlan,
  getSessionDetail,
  getSettings,
  getWorkout,
  listBlocks,
  listPlans,
  listSessionHistory,
  listWorkouts,
  searchExercises
} from "@forklift/core";
import { ApiError, createDebugger } from "@forklift/debug";

const debug = createDebugger("aiAccessTools");

const readOnly = {
  readOnlyHint: true,
  openWorldHint: false
} as const;

const json = (value: unknown): CallToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(value)
    }
  ]
});

// A core error (a Plan that doesn't exist, say) is the AI's to see and act on,
// so it comes back as a tool error rather than failing the request.
function answer(read: () => unknown): CallToolResult {
  try {
    return json(read());
  } catch (e) {
    if (!(e instanceof ApiError)) {
      throw e;
    }

    debug.info("tool error: %s", e.message);

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: e.message
        }
      ]
    };
  }
}

// Weights are stored in the lifter's unit, so an answer with weights says which.
const withUnit = <T extends object>(value: T) => ({
  ...value,
  unit: getSettings().unit
});

const idOf = (thing: string) => z.uuid().describe(`The ${thing}'s id`);

// The MCP server AI Access serves (ADR-0002): read tools over the core
// services. A fresh server is made per request.
export function createAiAccessMcpServer(): McpServer {
  const server = new McpServer({
    name: "forklift",
    version: "0.1.0"
  });

  server.registerTool("list_plans", {
    title: "List Plans",
    description: "Lists the lifter's Plans in their order. A Plan is a named collection of Workouts " +
      "cycled through in order; the Active Plan (isActive) is the one being followed.",
    annotations: readOnly
  }, () => answer(() => listPlans().map(({
    id, name, isActive
  }) => ({
    id,
    name,
    isActive
  }))));

  server.registerTool("get_plan", {
    title: "Get Plan",
    description: "Gets a Plan with its Workouts in rotation order and nextWorkoutId, the Workout " +
      "the lifter does next.",
    inputSchema: { planId: idOf("Plan") },
    annotations: readOnly
  }, ({ planId }) => answer(() => {
    const {
      id, name, isActive, nextWorkoutId
    } = getPlan(planId);

    return {
      id,
      name,
      isActive,
      nextWorkoutId,
      workouts: listWorkouts(planId).map(w => ({
        id: w.id,
        name: w.name
      }))
    };
  }));

  server.registerTool("get_workout", {
    title: "Get Workout",
    description: "Gets a Workout's Blocks in order. A Block with one Exercise Entry is straight sets; " +
      "one with two or more is a Superset, done alternately one set of each per round. Each entry " +
      "has its targets: sets, reps, weight, rest seconds and Weight Step.",
    inputSchema: { workoutId: idOf("Workout") },
    annotations: readOnly
  }, ({ workoutId }) => answer(() => {
    const {
      id, planId, name
    } = getWorkout(workoutId);

    return withUnit({
      id,
      planId,
      name,
      blocks: listBlocks(workoutId).map(block => ({
        id: block.id,
        exerciseEntries: block.exerciseEntries.map(entry => ({
          id: entry.id,
          exerciseId: entry.exerciseId,
          exerciseName: entry.exercise.name,
          targetSets: entry.targetSets,
          targetReps: entry.targetReps,
          targetWeight: entry.targetWeight,
          restSeconds: entry.restSeconds,
          weightStep: entry.weightStep
        }))
      }))
    });
  }));

  server.registerTool("search_exercises", {
    title: "Search Exercise Library",
    description: "Searches the Exercise Library by name, case-insensitively. Leave out the query to " +
      "list every Exercise.",
    inputSchema: {
      query: z.string().max(200)
        .optional()
        .describe("Part of the Exercise's name")
    },
    annotations: readOnly
  }, ({ query }) => answer(() => searchExercises(query ?? "").map(({
    id, name, muscleGroups, equipment, notes
  }) => ({
    id,
    name,
    muscleGroups,
    equipment,
    notes
  }))));

  server.registerTool("list_sessions", {
    title: "List Sessions",
    description: "Lists the lifter's finished Sessions, newest first. A Session is one performance " +
      "of a Workout.",
    annotations: readOnly
  }, () => answer(() => listSessionHistory()));

  server.registerTool("get_session", {
    title: "Get Session",
    description: "Gets a Session's Logged Sets by Block and Exercise Entry as they were at its start: " +
      "the reps and weight really done, or skipped.",
    inputSchema: { sessionId: idOf("Session") },
    annotations: readOnly
  }, ({ sessionId }) => answer(() => withUnit(getSessionDetail(sessionId))));

  server.registerTool("get_exercise_history", {
    title: "Get Exercise history",
    description: "Gets the sets done of an Exercise in each finished Session, newest first, with the " +
      "Best Set (heaviest, more reps breaking a tie) per Session and overall.",
    inputSchema: { exerciseId: idOf("Exercise") },
    annotations: readOnly
  }, ({ exerciseId }) => answer(() => withUnit(getExerciseHistory(exerciseId))));

  return server;
}
