import { createContext, use } from "react";

import type { BlockWithEntries } from "@forklift/core";
import type { ExerciseEntryUpdatePayload, Unit } from "@forklift/db/client";

export type Entry = BlockWithEntries["exerciseEntries"][number];

// What an edit that failed was on: an Exercise Entry, or a Superset's Round Rest.
export interface EditError {
  kind: "entry" | "superset";
  id: string;
  message: string;
}

// How the Plan editor edits Exercise Entries in place: one row's editor is
// open at a time, opened and closed by tapping the row.
export interface EntryEditing {
  editingId: string | undefined;
  // The last edit that failed.
  error: EditError | undefined;
  // A tap on the row: opens its editor, or closes it if it's the open one.
  onTap: (entry: Entry) => void;
  onChange: (entry: Entry, changes: ExerciseEntryUpdatePayload) => void;
  onRemove: (entry: Entry) => void;
  // A touch on a row or the open editor, which a tap elsewhere would close.
  onTouchInside: () => void;
}

// Select mode: a tick box on each row instead of its editor and reordering.
export interface RowSelecting {
  ticked: ReadonlySet<string>;
  // Ticks the Exercise Entries, or unticks them when all are ticked already
  // (a Superset's header toggles all of its own).
  onToggle: (entryIds: string[]) => void;
}

// What every row of the Plan editor's Exercise Entry list shares.
export interface EntryList {
  unit: Unit;
  editing: EntryEditing;
  // Set while Select mode is on.
  selecting: RowSelecting | undefined;
}

export const EntryListContext = createContext<EntryList | undefined>(undefined);

export function useEntryList(): EntryList {
  const list = use(EntryListContext);

  if (!list) {
    throw new Error("useEntryList must be used inside an EntryListContext provider");
  }

  return list;
}

// The message of an edit that failed on this Exercise Entry or Superset.
export const errorOn = (error: EditError | undefined, kind: EditError["kind"], id: string) => (error?.kind === kind && error.id === id ? error.message : undefined);
