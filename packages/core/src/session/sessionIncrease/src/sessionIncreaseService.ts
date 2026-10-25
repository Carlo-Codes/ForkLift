import type { TransactionType } from "@forklift/db/client";

import { getAllSessionIncreaseByQuery } from "./sessionIncreaseDb";

// The Exercise Entries of the Session with Increase Next Time on.
export function listIncreases(sessionId: string, tx?: TransactionType): string[] {
  return getAllSessionIncreaseByQuery({
    where: {
      sessionId,
      on: true,
      deletedAt: { isNull: true }
    }
  }, tx).map(increase => increase.exerciseEntryId);
}
