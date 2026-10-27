import {
  useCallback, useMemo, useState
} from "react";

import type { BlockWithEntries } from "@forklift/core";

import type { Entry, RowSelecting } from "./EntryListContext";

export interface RowSelection {
  // Set while Select mode is on, for the rows to show their tick boxes.
  selecting: RowSelecting | undefined;
  // The ticked Exercise Entries in the Workout's order, leaving out any gone
  // since they were ticked.
  tickedEntries: Entry[];
  // Whether a ticked Exercise Entry is part of a Superset.
  canUngroup: boolean;
  start: () => void;
  stop: () => void;
}

interface Ticks {
  scope: string;
  ticked: ReadonlySet<string>;
}

// Select mode over the Plan editor's Exercise Entries. It belongs to the Plan
// and Workout `scope` names, so it ends by itself when the editor shows
// another one (including the Workout being deleted or replaced) or the
// Workout has no rows left: the selection bar never outlives its rows.
export function useRowSelection(blocks: BlockWithEntries[], scope: string): RowSelection {
  const [ ticks, setTicks ] = useState<Ticks>();
  const ticked = ticks?.scope === scope && blocks.length > 0 ? ticks.ticked : undefined;

  const onToggle = useCallback((ids: string[]) => setTicks(current => {
    const next = new Set(current?.ticked);
    const untick = ids.every(id => next.has(id));

    for (const id of ids) {
      if (untick) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }

    return {
      scope,
      ticked: next
    };
  }), [ scope ]);

  const selecting = useMemo(() => ticked && {
    ticked,
    onToggle
  }, [ ticked, onToggle ]);

  return {
    selecting,
    tickedEntries: ticked ? blocks.flatMap(b => b.exerciseEntries).filter(e => ticked.has(e.id)) : [],
    canUngroup: Boolean(ticked) && blocks.some(b => b.exerciseEntries.length > 1 && b.exerciseEntries.some(e => ticked!.has(e.id))),
    start: () => setTicks({
      scope,
      ticked: new Set()
    }),
    stop: () => setTicks(undefined)
  };
}
