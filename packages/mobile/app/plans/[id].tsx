import { useLocalSearchParams } from "expo-router";

import { PlanEditor } from "@/components/PlanEditor";

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PlanEditor key={id}
      planId={id} />
  );
}
