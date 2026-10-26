import { setupTestDb } from "@forklift/db/server";
import type { ApiError } from "@forklift/debug";

import { exportBackup, importBackup } from "..";
import {
  createExercise, deleteExercise, listExercises
} from "../../../exercise/src";
import { getExerciseHistory, listSessionHistory } from "../../../history/src";
import {
  createPlan, getNextWorkout, listPlans, setActivePlan
} from "../../../plan/src";
import { createBlock, groupBlocks } from "../../../plan/workout/block/src";
import { createWorkout } from "../../../plan/workout/src";
import {
  completeSet, finishSession, resumeSession, setIncrease, skipSet, startSession
} from "../../../session/src";
import { getSettings, setUnit } from "../../../setting/src";

// The backup without its export time, to compare two exports of the same data.
const withoutExportTime = (backup: string) => ({
  ...JSON.parse(backup) as object,
  exportedAt: undefined
});

const validationError = (message: string) => expect.objectContaining({
  statusCode: 400,
  type: "ValidationError",
  message: expect.stringContaining(message) as unknown
}) as ApiError;

interface Backup {
  version: number;
  tables: Record<string, Record<string, unknown>[]>;
}

describe("backup", () => {
  let teardown: () => void;

  // Swaps in a fresh, empty database, as on a new phone.
  const newPhone = () => {
    teardown();
    ({ teardown } = setupTestDb());
  };

  // Something of every kind: lb, an Active Plan mid-rotation, a Superset, a
  // deleted Exercise, a finished Session with done, skipped and increased
  // entries, and a Session left in progress.
  const seed = () => {
    setUnit("lb");

    const { id: planId } = createPlan({ name: "PPL" });
    const { id: pushId } = createWorkout(planId, { name: "Push" });

    createWorkout(planId, { name: "Pull" });

    const { id: benchId } = createExercise({
      name: "Bench Press",
      muscleGroups: [ "chest" ],
      equipment: "barbell",
      notes: "Elbows in"
    });
    const { id: flyId } = createExercise({
      name: "Cable Fly",
      muscleGroups: [ "chest" ]
    });
    const { id: dipId } = createExercise({
      name: "Dip",
      muscleGroups: [ "triceps" ]
    });
    const bench = createBlock(pushId, {
      exerciseId: benchId,
      targetSets: 2,
      targetReps: 5,
      targetWeight: 135
    });

    groupBlocks(pushId, [
      createBlock(pushId, { exerciseId: flyId }).id,
      createBlock(pushId, { exerciseId: dipId }).id
    ]);
    setActivePlan(planId);

    const { id: sessionId } = startSession(pushId);

    completeSet(sessionId, { reps: 4 });
    skipSet(sessionId);
    setIncrease(sessionId, bench.exerciseEntries[ 0 ]!.id, true);
    finishSession(sessionId);
    deleteExercise(dipId);
    startSession(pushId);

    return { benchId };
  };

  beforeEach(() => {
    ({ teardown } = setupTestDb());
  });

  afterEach(() => teardown());

  it("restores everything on a new phone, soft-deleted rows included", () => {
    const { benchId } = seed();
    const backup = exportBackup();

    newPhone();
    importBackup(backup);

    expect(withoutExportTime(exportBackup())).toEqual(withoutExportTime(backup));
    expect(getSettings().unit).toBe("lb");
    expect(getNextWorkout()?.name).toBe("Pull");
    expect(listSessionHistory().map(s => s.workoutName)).toEqual([ "Push" ]);
    expect(getExerciseHistory(benchId).sessions[ 0 ]!.sets.map(s => s.reps)).toEqual([ 4 ]);
    expect(resumeSession()?.current?.targetWeight).toBe(140);
  });

  it("replaces the data already on the phone rather than merging with it", () => {
    seed();
    const backup = exportBackup();

    newPhone();
    setUnit("kg");
    createPlan({ name: "Starting Strength" });
    createExercise({
      name: "Power Clean",
      muscleGroups: [ "traps" ]
    });
    importBackup(backup);

    expect(getSettings().unit).toBe("lb");
    expect(listPlans().map(p => p.name)).toEqual([ "PPL" ]);
    expect(listExercises().map(e => e.name)).toEqual([ "Bench Press", "Cable Fly" ]);
  });

  it("restores a version 1 backup, from before Changes by AI, with none", () => {
    seed();
    const backup = JSON.parse(exportBackup()) as Backup;

    backup.version = 1;
    delete backup.tables.aiChange;

    newPhone();
    importBackup(JSON.stringify(backup));

    expect(listPlans().map(p => p.name)).toEqual([ "PPL" ]);
    expect((JSON.parse(exportBackup()) as Backup).tables.aiChange).toEqual([]);
  });

  describe("a file it won't restore", () => {
    let backup: string;
    let before: object;

    // The seeded backup, changed by edit, as JSON text.
    const changed = (edit: (b: Backup) => void) => {
      const b = JSON.parse(backup) as Backup;

      edit(b);

      return JSON.stringify(b);
    };

    beforeEach(() => {
      seed();
      backup = exportBackup();
      newPhone();
      setUnit("kg");
      createPlan({ name: "Starting Strength" });
      before = withoutExportTime(exportBackup());
    });

    afterEach(() => {
      expect(withoutExportTime(exportBackup())).toEqual(before);
    });

    it("rejects a file that isn't JSON or isn't a ForkLift backup", () => {
      expect(() => importBackup("not json")).toThrow(validationError("isn't a ForkLift backup"));
      expect(() => importBackup(JSON.stringify({ plans: [] }))).toThrow(validationError("isn't a ForkLift backup"));
    });

    it("rejects a backup from a newer version of ForkLift", () => {
      expect(() => importBackup(changed(b => {
        b.version = 3;
      }))).toThrow(validationError("newer version of ForkLift"));
    });

    it("rejects a backup with an invalid row", () => {
      expect(() => importBackup(changed(b => {
        b.tables.loggedSet![ 0 ]!.reps = -1;
      }))).toThrow(validationError("Reps can't be negative"));
      expect(() => importBackup(changed(b => {
        delete b.tables.exercise;
      }))).toThrow(validationError("expected array"));
    });

    it("rejects a backup with a table or column it doesn't know, rather than dropping it", () => {
      expect(() => importBackup(changed(b => {
        b.tables.workoutNote = [];
      }))).toThrow(validationError("workoutNote"));
      expect(() => importBackup(changed(b => {
        b.tables.plan![ 0 ]!.colour = "red";
      }))).toThrow(validationError("colour"));
    });

    it("rejects a backup that breaks a rule, such as two Active Plans", () => {
      expect(() => importBackup(changed(b => {
        b.tables.plan!.push({
          ...b.tables.plan![ 0 ]!,
          id: crypto.randomUUID()
        });
      }))).toThrow(validationError("only one Active Plan"));
    });

    it("rejects a backup whose rows don't fit together, restoring none of it", () => {
      expect(() => importBackup(changed(b => {
        b.tables.loggedSet![ 0 ]!.sessionId = crypto.randomUUID();
      }))).toThrow(validationError("damaged"));
    });
  });
});
