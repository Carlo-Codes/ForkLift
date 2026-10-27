import type { BlockWithEntries } from "@forklift/core";

import { ExerciseEntryRow } from "./ExerciseEntryRow";
import { SupersetGroup } from "./SupersetGroup";

interface BlockItemProps {
  block: BlockWithEntries;
  onSetRoundRest: (restSeconds: number) => void;
  onMoveEntry: (index: number, delta: -1 | 1) => void;
  onAddToSuperset: () => void;
  // Omitted at the top / bottom of the Workout.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// One Block of the selected Workout in the Plan editor: a single Exercise
// Entry as a row, or a Superset as a bordered group. Reordering (8/9)
// replaces the up/down buttons here.
export function BlockItem({
  block, onSetRoundRest, onMoveEntry, onAddToSuperset, onMoveUp, onMoveDown
}: BlockItemProps) {
  const [ entry, ...others ] = block.exerciseEntries;

  if (!entry) {
    return null;
  }

  return others.length > 0 ?
    (
      <SupersetGroup
        block={block}
        onSetRoundRest={onSetRoundRest}
        onMoveEntry={onMoveEntry}
        onAddEntry={onAddToSuperset}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    ) :
    (
      <ExerciseEntryRow entry={entry}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        first
        last />
    );
}
