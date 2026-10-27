import { router } from "expo-router";

import { createPlanWithWorkouts } from "@forklift/core";

import { NewPlanForm } from "@/components/NewPlanForm";

// Create plan: a short form, then the new Plan opens in the Plan editor in
// the form's place, so Back returns to the Plans list.
export default function NewPlanScreen() {
  return (
    <NewPlanForm onCreate={payload => {
      const { id } = createPlanWithWorkouts(payload);

      router.replace({
        pathname: "/plans/[id]",
        params: { id }
      });
    }} />
  );
}
