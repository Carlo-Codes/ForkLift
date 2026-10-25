import type { LoggedSetAttributes, TransactionType } from "@forklift/db/client";

import { getAllLoggedSetByQuery } from "./loggedSetDb";

export function listLoggedSets(sessionId: string, tx?: TransactionType): LoggedSetAttributes[] {
  return getAllLoggedSetByQuery({
    where: {
      sessionId,
      deletedAt: { isNull: true }
    }
  }, tx);
}
