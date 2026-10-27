import type { BlockWithEntries } from "@forklift/core";

import { ExerciseEntryRow } from "./ExerciseEntryRow";
import { SupersetGroup } from "./SupersetGroup";

interface BlockItemProps {
  block: BlockWithEntries;
  onSetRoundRest: (restSeconds: number) => void;
  // The Superset's Exercise Entry ids in their new order.
  onReorderEntries: (exerciseEntryIds: string[]) => void;
  onAddToSuperset: () => void;
}

// One Block of the selected Workout in the Plan editor, an item of its
// DragList: a single Exercise Entry as a row, or a Superset as a bordered
// group. Either's drag handle moves the whole Block.
export function BlockItem({
  block, onSetRoundRest, onReorderEntries, onAddToSuperset
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
        onReorderEntries={onReorderEntries}
        onAddEntry={onAddToSuperset}
      />
    ) :
    (
      <ExerciseEntryRow entry={entry}
        first
        last />
    );
}
