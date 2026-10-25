import { getDb } from "@forklift/db/client";
import type { TransactionType } from "@forklift/db/client";

// Runs fn in the caller's transaction, or in a new one when there is none, so a
// multi-row write is all-or-nothing either way. fn must be sync (see settingDb).
export function inTransaction<T>(tx: TransactionType | undefined, fn: (tx: TransactionType) => T): T {
  if (tx) {
    return fn(tx);
  }

  // drizzle types a sync transaction's result through a conditional type that a
  // generic T can't satisfy, so the result is carried out of a void callback.
  let result!: T;

  getDb().transaction(t => {
    result = fn(t);
  });

  return result;
}
