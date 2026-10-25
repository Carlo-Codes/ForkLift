import { planCreatePayloadSchema, planUpdatePayloadSchema } from "@forklift/db/client";
import type {
  PlanAttributes,
  PlanCreatePayload,
  PlanUpdatePayload,
  TransactionType
} from "@forklift/db/client";
import { ApiError, createDebugger } from "@forklift/debug";

import { nextPosition, orderOrThrow } from "../../utils/position";
import { inTransaction } from "../../utils/transaction";
import { parseOrThrow } from "../../utils/validation";
import {
  createPlanDb,
  deletePlanDb,
  getAllPlanByQuery,
  getPlanByQuery,
  updatePlanDb
} from "./planDb";

const debug = createDebugger("planService");

export function listPlans(tx?: TransactionType): PlanAttributes[] {
  return getAllPlanByQuery({ where: { deletedAt: { isNull: true } } }, tx);
}

// Soft-deleted Plans are gone as far as the lifter is concerned.
export function getPlan(id: string, tx?: TransactionType): PlanAttributes {
  const plan = getPlanByQuery({
    where: {
      id,
      deletedAt: { isNull: true }
    }
  }, tx);

  if (!plan) {
    throw new ApiError(404, `Plan ${id} not found`, "NotFoundError");
  }

  return plan;
}

export function createPlan(payload: PlanCreatePayload, tx?: TransactionType): PlanAttributes {
  const data = parseOrThrow(planCreatePayloadSchema, payload);

  debug.info("creating plan %s", data.name);

  return createPlanDb({
    ...data,
    position: nextPosition(listPlans(tx)),
    isActive: false
  }, tx);
}

export function updatePlan(
  id: string,
  payload: PlanUpdatePayload,
  tx?: TransactionType
): PlanAttributes {
  const data = parseOrThrow(planUpdatePayloadSchema, payload);

  getPlan(id, tx);
  debug.info("updating plan %s", id);

  return updatePlanDb(id, data, tx);
}

export function deletePlan(id: string, tx?: TransactionType): void {
  inTransaction(tx, t => {
    getPlan(id, t);
    debug.info("deleting plan %s", id);
    deletePlanDb(id, t);
  });
}

// orderedIds lists every live Plan, first to last.
export function reorderPlans(orderedIds: string[], tx?: TransactionType): void {
  inTransaction(tx, t => {
    for (const { id, position } of orderOrThrow(listPlans(t), orderedIds)) {
      updatePlanDb(id, { position }, t);
    }
  });
}

export function getActivePlan(tx?: TransactionType): PlanAttributes | undefined {
  return getPlanByQuery({
    where: {
      isActive: true,
      deletedAt: { isNull: true }
    }
  }, tx);
}

// Makes id the one Active Plan, or leaves none Active when id is null.
export function setActivePlan(id: string | null, tx?: TransactionType): void {
  inTransaction(tx, t => {
    if (id) {
      getPlan(id, t);
    }

    debug.info("setting active plan to %s", id);

    for (const plan of getAllPlanByQuery({ where: { isActive: true } }, t)) {
      updatePlanDb(plan.id, { isActive: false }, t);
    }

    if (id) {
      updatePlanDb(id, { isActive: true }, t);
    }
  });
}
