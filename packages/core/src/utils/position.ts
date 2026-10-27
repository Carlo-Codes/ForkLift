import { z } from "zod";

import { ApiError } from "@forklift/debug";

import { parseOrThrow } from "./validation";

const orderedIdsSchema = z.array(z.uuid());

interface Positioned {
  id: string;
  position: number;
}

// New rows go after their live siblings.
export function nextPosition(siblings: { position: number }[]): number {
  return siblings.reduce((max, s) => Math.max(max, s.position + 1), 0);
}

// Numbers rows 0..n-1 in the order given, so positions are unique and have no
// gaps. Returns just the rows whose position changes, with the new one: rows
// already in place are left unwritten.
export function renumber(rows: Positioned[]): Positioned[] {
  return rows.flatMap(({ id, position: was }, position) => (was === position ?
    [] :
    [
      {
        id,
        position
      }
    ]));
}

// Puts a row back among its live siblings at its old position, ahead of any
// sibling that has taken that position since, renumbering them all.
export function slotIn(siblings: Positioned[], returning: Positioned): Positioned[] {
  const ordered = siblings.toSorted((a, b) => a.position - b.position);
  const at = ordered.findIndex(s => s.position >= returning.position);

  ordered.splice(at === -1 ? ordered.length : at, 0, returning);

  return renumber(ordered);
}

// A reorder names every live sibling exactly once, so nothing is lost or
// duplicated. The siblings are renumbered in that order, so the same order
// writes nothing.
export function orderOrThrow(siblings: Positioned[], orderedIds: string[]): Positioned[] {
  const ids = parseOrThrow(orderedIdsSchema, orderedIds);
  const current = new Map(siblings.map(s => [ s.id, s ]));

  if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every(id => current.has(id))) {
    throw new ApiError(400, "The new order must list each item exactly once", "ValidationError");
  }

  return renumber(ids.map(id => current.get(id)!));
}
