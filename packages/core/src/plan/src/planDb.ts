import {
  eq, getDb, planTable
} from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreateAttributes,
  QueryFilters,
  TransactionType
} from "@forklift/db/client";

import { deleteWorkoutDb, getAllWorkoutByQuery } from "../workout/src/workoutDb";

// Plans read in the lifter's order unless asked otherwise.
export function getAllPlanByQuery(
  filters: QueryFilters<"planTable">,
  tx?: TransactionType
): PlanAttributes[] {
  const db = tx ?? getDb();

  return db.query.planTable.findMany({
    columns: filters.columns,
    where: filters.where,
    orderBy: filters.pagination?.orderBy ?? { position: "asc" },
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  }).sync();
}

export function getPlanByQuery(
  filters: QueryFilters<"planTable">,
  tx?: TransactionType
): PlanAttributes | undefined {
  const db = tx ?? getDb();

  return db.query.planTable.findFirst({
    columns: filters.columns,
    where: filters.where
  }).sync();
}

export function createPlanDb(
  data: PlanCreateAttributes,
  tx?: TransactionType
): PlanAttributes {
  const db = tx ?? getDb();

  const row = db.insert(planTable).values(data)
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to create plan");
  }

  return row;
}

export function updatePlanDb(
  id: string,
  data: Partial<PlanCreateAttributes>,
  tx?: TransactionType
): PlanAttributes {
  const db = tx ?? getDb();

  const row = db.update(planTable).set(data)
    .where(eq(planTable.id, id))
    .returning()
    .get();

  if (!row) {
    throw new Error(`Failed to update plan ${id}`);
  }

  return row;
}

// Soft delete (ADR-0003): the row stays so past Sessions keep their Plan and the
// deletion can sync. A deleted Plan is never the Active Plan, and its live
// Workouts go with it. Call inside a transaction.
export function deletePlanDb(id: string, tx?: TransactionType): PlanAttributes {
  for (const workout of getAllWorkoutByQuery({
    where: {
      planId: id,
      deletedAt: { isNull: true }
    }
  }, tx)) {
    deleteWorkoutDb(workout.id, tx);
  }

  return updatePlanDb(id, {
    deletedAt: new Date(),
    isActive: false
  }, tx);
}
