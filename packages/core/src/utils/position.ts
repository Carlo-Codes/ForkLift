import { z } from "zod";

import { ApiError } from "@forklift/debug";

import { parseOrThrow } from "./validation";

const orderedIdsSchema = z.array(z.uuid());

// New rows go after their live siblings.
export function nextPosition(siblings: { position: number }[]): number {
  return siblings.reduce((max, s) => Math.max(max, s.position + 1), 0);
}

// Puts a row back among its live siblings at its old position, ahead of any
// sibling that has taken that position since, and numbers them all from 0 so
// positions stay unique. Returns just the rows whose position changes.
export function slotIn(
  siblings: { id: string; position: number }[],
  returning: { id: string; position: number }
): { id: string; position: number }[] {
  const ordered = siblings.toSorted((a, b) => a.position - b.position);
  const at = ordered.findIndex(s => s.position >= returning.position);

  ordered.splice(at === -1 ? ordered.length : at, 0, returning);

  return ordered.flatMap((row, position) => (row.position === position ?
    [] :
    [
      {
        id: row.id,
        position
      }
    ]));
}

// A reorder names every live sibling exactly once, so nothing is lost or
// duplicated. The siblings are numbered from 0 in that order; the result is
// just the rows whose position changes, so the same order writes nothing.
export function orderOrThrow(
  siblings: { id: string; position: number }[],
  orderedIds: string[]
): { id: string; position: number }[] {
  const ids = parseOrThrow(orderedIdsSchema, orderedIds);
  const current = new Map(siblings.map(s => [ s.id, s.position ]));

  if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every(id => current.has(id))) {
    throw new ApiError(400, "The new order must list each item exactly once", "ValidationError");
  }

  return ids.flatMap((id, position) => (current.get(id) === position ?
    [] :
    [
      {
        id,
        position
      }
    ]));
}
