import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  createBlock,
  createExercise,
  createExerciseEntry,
  createPlan,
  createWorkout,
  deleteBlock,
  deleteExercise,
  deleteExerciseEntry,
  deletePlan,
  deleteWorkout,
  getExerciseHistory,
  getPlan,
  getSessionDetail,
  getSettings,
  getWorkout,
  groupBlocks,
  listBlocks,
  listPlans,
  listSessionHistory,
  listWorkouts,
  reorderBlocks,
  reorderExerciseEntries,
  reorderPlans,
  reorderWorkouts,
  searchExercises,
  ungroupBlock,
  updateExercise,
  updateExerciseEntry,
  updatePlan,
  updateWorkout
} from "@forklift/core";
import type { BlockWithEntries } from "@forklift/core";
import { equipmentValues, muscleGroupValues } from "@forklift/db/client";
import type { ExerciseAttributes, ExerciseEntryAttributes } from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

const debug = createDebugger("aiAccessTools");

const readOnly = {
  readOnlyHint: true,
  openWorldHint: false
} as const;

// Every write goes through core as the AI, which records it in Changes by AI
// and refuses anything touching Sessions or the Active Plan (ADR-0002).
const writes = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false
} as const;

const deletes = {
  ...writes,
  destructiveHint: true
} as const;

const UNDO_NOTE = " The lifter sees it in Changes by AI and can undo it.";

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
const orderOf = (things: string) => z.array(z.uuid()).describe(`Every one of the ${things}' ids, once each, first to last`);
const done = { done: true };

// Exercise Entry targets as the write tools take them; core checks the ranges.
const targets = {
  targetSets: z.number().int()
    .optional()
    .describe("Number of sets"),
  targetReps: z.number().int()
    .optional()
    .describe("Reps per set"),
  targetWeight: z.number().optional()
    .describe("Weight per set in the lifter's unit (see get_workout); 0 for bodyweight"),
  restSeconds: z.number().int()
    .optional()
    .describe("Rest after each set (after each round in a Superset), in seconds"),
  weightStep: z.number().optional()
    .describe("How much Increase Next Time raises the target weight, in the lifter's unit")
};

const exerciseFields = {
  name: z.string().describe("The Exercise's name"),
  muscleGroups: z.array(z.enum(muscleGroupValues)).describe("The muscles it works"),
  equipment: z.enum(equipmentValues).nullable()
    .optional()
    .describe("The kit it needs"),
  notes: z.string().nullable()
    .optional()
    .describe("Cues or setup notes")
};

const entryView = (entry: ExerciseEntryAttributes) => ({
  id: entry.id,
  exerciseId: entry.exerciseId,
  targetSets: entry.targetSets,
  targetReps: entry.targetReps,
  targetWeight: entry.targetWeight,
  restSeconds: entry.restSeconds,
  weightStep: entry.weightStep
});

const blockView = (block: BlockWithEntries) => ({
  id: block.id,
  exerciseEntries: block.exerciseEntries.map(entry => ({
    ...entryView(entry),
    exerciseName: entry.exercise.name
  }))
});

const exerciseView = ({
  id, name, muscleGroups, equipment, notes
}: ExerciseAttributes) => ({
  id,
  name,
  muscleGroups,
  equipment,
  notes
});

// The MCP server AI Access serves (ADR-0002): read tools over the core
// services, and write tools for Plans, Workouts and the Exercise Library. No
// tool writes Sessions or Logged Sets. A fresh server is made per request.
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
      blocks: listBlocks(workoutId).map(blockView)
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
  }, ({ query }) => answer(() => searchExercises(query ?? "").map(exerciseView)));

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

  server.registerTool("create_plan", {
    title: "Create Plan",
    description: "Creates a Plan at the end of the lifter's list. It isn't made the Active Plan: only " +
      "the lifter chooses that." + UNDO_NOTE,
    inputSchema: { name: z.string().describe("The Plan's name, e.g. \"Push / Pull / Legs\"") },
    annotations: writes
  }, ({ name }) => answer(() => {
    const { id } = createPlan({ name }, "ai");

    return {
      id,
      name: getPlan(id).name
    };
  }));

  server.registerTool("rename_plan", {
    title: "Rename Plan",
    description: "Renames a Plan." + UNDO_NOTE,
    inputSchema: {
      planId: idOf("Plan"),
      name: z.string().describe("The new name")
    },
    annotations: writes
  }, ({ planId, name }) => answer(() => {
    updatePlan(planId, { name }, "ai");

    return done;
  }));

  server.registerTool("delete_plan", {
    title: "Delete Plan",
    description: "Deletes a Plan with its Workouts. The Active Plan can't be deleted." + UNDO_NOTE,
    inputSchema: { planId: idOf("Plan") },
    annotations: deletes
  }, ({ planId }) => answer(() => {
    deletePlan(planId, "ai");

    return done;
  }));

  server.registerTool("reorder_plans", {
    title: "Reorder Plans",
    description: "Puts the lifter's Plans in a new order." + UNDO_NOTE,
    inputSchema: { planIds: orderOf("Plans") },
    annotations: writes
  }, ({ planIds }) => answer(() => {
    reorderPlans(planIds, "ai");

    return done;
  }));

  server.registerTool("create_workout", {
    title: "Create Workout",
    description: "Adds a Workout at the end of a Plan's rotation. Add its exercises with add_block." + UNDO_NOTE,
    inputSchema: {
      planId: idOf("Plan"),
      name: z.string().describe("The Workout's name, e.g. \"Push\"")
    },
    annotations: writes
  }, ({ planId, name }) => answer(() => {
    const workout = createWorkout(planId, { name }, "ai");

    return {
      id: workout.id,
      planId,
      name: workout.name
    };
  }));

  server.registerTool("rename_workout", {
    title: "Rename Workout",
    description: "Renames a Workout." + UNDO_NOTE,
    inputSchema: {
      workoutId: idOf("Workout"),
      name: z.string().describe("The new name")
    },
    annotations: writes
  }, ({ workoutId, name }) => answer(() => {
    updateWorkout(workoutId, { name }, "ai");

    return done;
  }));

  server.registerTool("delete_workout", {
    title: "Delete Workout",
    description: "Deletes a Workout from its Plan. Its past Sessions stay in the lifter's history." + UNDO_NOTE,
    inputSchema: { workoutId: idOf("Workout") },
    annotations: deletes
  }, ({ workoutId }) => answer(() => {
    deleteWorkout(workoutId, "ai");

    return done;
  }));

  server.registerTool("reorder_workouts", {
    title: "Reorder Workouts",
    description: "Puts a Plan's Workouts in a new rotation order." + UNDO_NOTE,
    inputSchema: {
      planId: idOf("Plan"),
      workoutIds: orderOf("Plan's Workouts")
    },
    annotations: writes
  }, ({ planId, workoutIds }) => answer(() => {
    reorderWorkouts(planId, workoutIds, "ai");

    return done;
  }));

  server.registerTool("add_block", {
    title: "Add Block",
    description: "Adds an Exercise as straight sets at the end of a Workout, with its targets. Targets " +
      "left out take the defaults. Turn Blocks into a Superset with group_superset or add_to_superset. " +
      "A change to the Workout of a Session in progress applies from the next Session." + UNDO_NOTE,
    inputSchema: {
      workoutId: idOf("Workout"),
      exerciseId: idOf("Exercise"),
      ...targets
    },
    annotations: writes
  }, ({ workoutId, ...entry }) => answer(() => withUnit(blockView(createBlock(workoutId, entry, "ai")))));

  server.registerTool("delete_block", {
    title: "Delete Block",
    description: "Removes a Block, a Superset with all its Exercise Entries, from its Workout." + UNDO_NOTE,
    inputSchema: { blockId: idOf("Block") },
    annotations: deletes
  }, ({ blockId }) => answer(() => {
    deleteBlock(blockId, "ai");

    return done;
  }));

  server.registerTool("reorder_blocks", {
    title: "Reorder Blocks",
    description: "Puts a Workout's Blocks in a new order." + UNDO_NOTE,
    inputSchema: {
      workoutId: idOf("Workout"),
      blockIds: orderOf("Workout's Blocks")
    },
    annotations: writes
  }, ({ workoutId, blockIds }) => answer(() => {
    reorderBlocks(workoutId, blockIds, "ai");

    return done;
  }));

  server.registerTool("group_superset", {
    title: "Make Superset",
    description: "Merges two or more Blocks that sit next to each other in a Workout into one Superset, " +
      "in the place of the first." + UNDO_NOTE,
    inputSchema: {
      workoutId: idOf("Workout"),
      blockIds: z.array(z.uuid()).describe("The Blocks' ids, in Workout order")
    },
    annotations: writes
  }, ({ workoutId, blockIds }) => answer(() => withUnit(blockView(groupBlocks(workoutId, blockIds, "ai")))));

  server.registerTool("split_superset", {
    title: "Split Superset",
    description: "Splits a Superset into Blocks of straight sets, one per Exercise Entry, in its place." + UNDO_NOTE,
    inputSchema: { blockId: idOf("Superset's Block") },
    annotations: writes
  }, ({ blockId }) => answer(() => withUnit({ blocks: ungroupBlock(blockId, "ai").map(blockView) })));

  server.registerTool("add_to_superset", {
    title: "Add to Superset",
    description: "Adds an Exercise Entry to the end of a Block, making it a Superset if it was straight " +
      "sets. Targets left out take the defaults." + UNDO_NOTE,
    inputSchema: {
      blockId: idOf("Block"),
      exerciseId: idOf("Exercise"),
      ...targets
    },
    annotations: writes
  }, ({ blockId, ...entry }) => answer(() => withUnit(entryView(createExerciseEntry(blockId, entry, "ai")))));

  server.registerTool("update_exercise_entry", {
    title: "Change Exercise Entry",
    description: "Changes an Exercise Entry's targets, or swaps its Exercise. Only the fields given " +
      "change. A change to the Workout of a Session in progress applies from the next Session." + UNDO_NOTE,
    inputSchema: {
      exerciseEntryId: idOf("Exercise Entry"),
      exerciseId: idOf("new Exercise").optional(),
      ...targets
    },
    annotations: writes
  }, ({ exerciseEntryId, ...changes }) => answer(() => withUnit(entryView(updateExerciseEntry(exerciseEntryId, changes, "ai")))));

  server.registerTool("delete_exercise_entry", {
    title: "Delete Exercise Entry",
    description: "Removes an Exercise Entry from its Block; removing a Block's last one removes the Block." + UNDO_NOTE,
    inputSchema: { exerciseEntryId: idOf("Exercise Entry") },
    annotations: deletes
  }, ({ exerciseEntryId }) => answer(() => {
    deleteExerciseEntry(exerciseEntryId, "ai");

    return done;
  }));

  server.registerTool("reorder_superset", {
    title: "Reorder Superset",
    description: "Puts the Exercise Entries of a Superset in a new order." + UNDO_NOTE,
    inputSchema: {
      blockId: idOf("Superset's Block"),
      exerciseEntryIds: orderOf("Superset's Exercise Entries")
    },
    annotations: writes
  }, ({ blockId, exerciseEntryIds }) => answer(() => {
    reorderExerciseEntries(blockId, exerciseEntryIds, "ai");

    return done;
  }));

  server.registerTool("create_exercise", {
    title: "Add Exercise",
    description: "Adds an Exercise to the Exercise Library. Search it first: it may already be there." + UNDO_NOTE,
    inputSchema: exerciseFields,
    annotations: writes
  }, exercise => answer(() => exerciseView(createExercise(exercise, "ai"))));

  server.registerTool("update_exercise", {
    title: "Edit Exercise",
    description: "Edits an Exercise in the Exercise Library, everywhere it's used. Only the fields " +
      "given change." + UNDO_NOTE,
    inputSchema: {
      exerciseId: idOf("Exercise"),
      ...exerciseFields,
      name: exerciseFields.name.optional(),
      muscleGroups: exerciseFields.muscleGroups.optional()
    },
    annotations: writes
  }, ({ exerciseId, ...changes }) => answer(() => exerciseView(updateExercise(exerciseId, changes, "ai"))));

  server.registerTool("delete_exercise", {
    title: "Delete Exercise",
    description: "Deletes an Exercise from the Exercise Library. Workouts using it and the lifter's " +
      "history keep it by name." + UNDO_NOTE,
    inputSchema: { exerciseId: idOf("Exercise") },
    annotations: deletes
  }, ({ exerciseId }) => answer(() => {
    deleteExercise(exerciseId, "ai");

    return done;
  }));

  return server;
}
