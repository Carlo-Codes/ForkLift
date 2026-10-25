import { z } from "zod";

import { ApiError } from "@forklift/debug";

import { parseOrThrow } from "./validation";

const orderedIdsSchema = z.array(z.uuid());

// New rows go after their live siblings.
export function nextPosition(siblings: { position: number }[]): number {
  return siblings.reduce((max, s) => Math.max(max, s.position + 1), 0);
}

// A reorder names every live sibling exactly once, so nothing is lost or
// duplicated; the result is each id with its new 0-based position.
export function orderOrThrow(
  siblings: { id: string }[],
  orderedIds: string[]
): { id: string; position: number }[] {
  const ids = parseOrThrow(orderedIdsSchema, orderedIds);
  const current = new Set(siblings.map(s => s.id));

  if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every(id => current.has(id))) {
    throw new ApiError(400, "The new order must list each item exactly once", "ValidationError");
  }

  return ids.map((id, position) => ({
    id,
    position
  }));
}
