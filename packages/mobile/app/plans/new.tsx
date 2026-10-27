import { router } from "expo-router";
import { View } from "react-native";

import { createPlan } from "@forklift/core";

import { NameInput } from "@/components/NameInput";
import { Screen } from "@/components/Screen";

// Names a new Plan, then opens it in place of this screen. The unified Plan
// editor replaces this step (docs/ui-redesign.md, issue 5/9).
export default function NewPlanScreen() {
  return (
    <Screen>
      <View className="p-4">
        <NameInput
          placeholder="Plan name, e.g. Push / Pull / Legs"
          submitLabel="Create"
          onSubmit={name => {
            const plan = createPlan({ name });

            router.replace({
              pathname: "/plans/[id]",
              params: { id: plan.id }
            });
          }}
        />
      </View>
    </Screen>
  );
}
