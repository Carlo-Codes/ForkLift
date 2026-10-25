import type { ExerciseCreatePayload } from "@forklift/db/client";

// ForkLift's own built-in Exercise Library (AGPL-3.0, ADR-0004), loaded once on
// first launch as ordinary rows the lifter can edit or delete.
export const builtInExercises: ExerciseCreatePayload[] = [
  // Chest
  {
    name: "Barbell Bench Press",
    muscleGroups: [
      "chest",
      "triceps",
      "shoulders"
    ],
    equipment: "barbell"
  },
  {
    name: "Incline Barbell Bench Press",
    muscleGroups: [
      "chest",
      "shoulders",
      "triceps"
    ],
    equipment: "barbell"
  },
  {
    name: "Decline Barbell Bench Press",
    muscleGroups: [ "chest", "triceps" ],
    equipment: "barbell"
  },
  {
    name: "Close-Grip Bench Press",
    muscleGroups: [ "triceps", "chest" ],
    equipment: "barbell"
  },
  {
    name: "Dumbbell Bench Press",
    muscleGroups: [
      "chest",
      "triceps",
      "shoulders"
    ],
    equipment: "dumbbell"
  },
  {
    name: "Incline Dumbbell Bench Press",
    muscleGroups: [
      "chest",
      "shoulders",
      "triceps"
    ],
    equipment: "dumbbell"
  },
  {
    name: "Dumbbell Fly",
    muscleGroups: [ "chest" ],
    equipment: "dumbbell"
  },
  {
    name: "Incline Dumbbell Fly",
    muscleGroups: [ "chest", "shoulders" ],
    equipment: "dumbbell"
  },
  {
    name: "Cable Fly",
    muscleGroups: [ "chest" ],
    equipment: "cable"
  },
  {
    name: "Low-to-High Cable Fly",
    muscleGroups: [ "chest", "shoulders" ],
    equipment: "cable"
  },
  {
    name: "Machine Chest Press",
    muscleGroups: [ "chest", "triceps" ],
    equipment: "machine"
  },
  {
    name: "Pec Deck",
    muscleGroups: [ "chest" ],
    equipment: "machine"
  },
  {
    name: "Push-Up",
    muscleGroups: [
      "chest",
      "triceps",
      "shoulders"
    ],
    equipment: "bodyweight"
  },
  {
    name: "Dip",
    muscleGroups: [
      "chest",
      "triceps",
      "shoulders"
    ],
    equipment: "bodyweight"
  },
  {
    name: "Smith Machine Bench Press",
    muscleGroups: [ "chest", "triceps" ],
    equipment: "smith machine"
  },

  // Back
  {
    name: "Conventional Deadlift",
    muscleGroups: [
      "hamstrings",
      "glutes",
      "lower back",
      "traps"
    ],
    equipment: "barbell"
  },
  {
    name: "Sumo Deadlift",
    muscleGroups: [
      "glutes",
      "quads",
      "hamstrings",
      "adductors"
    ],
    equipment: "barbell"
  },
  {
    name: "Trap Bar Deadlift",
    muscleGroups: [
      "quads",
      "glutes",
      "hamstrings",
      "traps"
    ],
    equipment: "trap bar"
  },
  {
    name: "Barbell Row",
    muscleGroups: [
      "back",
      "lats",
      "biceps"
    ],
    equipment: "barbell"
  },
  {
    name: "Pendlay Row",
    muscleGroups: [ "back", "lats" ],
    equipment: "barbell"
  },
  {
    name: "T-Bar Row",
    muscleGroups: [
      "back",
      "lats",
      "biceps"
    ],
    equipment: "barbell"
  },
  {
    name: "One-Arm Dumbbell Row",
    muscleGroups: [
      "lats",
      "back",
      "biceps"
    ],
    equipment: "dumbbell"
  },
  {
    name: "Chest-Supported Dumbbell Row",
    muscleGroups: [ "back", "rear delts" ],
    equipment: "dumbbell"
  },
  {
    name: "Seated Cable Row",
    muscleGroups: [
      "back",
      "lats",
      "biceps"
    ],
    equipment: "cable"
  },
  {
    name: "Machine Row",
    muscleGroups: [ "back", "lats" ],
    equipment: "machine"
  },
  {
    name: "Pull-Up",
    muscleGroups: [
      "lats",
      "back",
      "biceps"
    ],
    equipment: "bodyweight"
  },
  {
    name: "Chin-Up",
    muscleGroups: [ "lats", "biceps" ],
    equipment: "bodyweight"
  },
  {
    name: "Lat Pulldown",
    muscleGroups: [ "lats", "biceps" ],
    equipment: "cable"
  },
  {
    name: "Close-Grip Lat Pulldown",
    muscleGroups: [ "lats", "biceps" ],
    equipment: "cable"
  },
  {
    name: "Straight-Arm Pulldown",
    muscleGroups: [ "lats" ],
    equipment: "cable"
  },
  {
    name: "Inverted Row",
    muscleGroups: [ "back", "biceps" ],
    equipment: "bodyweight"
  },
  {
    name: "Rack Pull",
    muscleGroups: [
      "back",
      "traps",
      "glutes"
    ],
    equipment: "barbell"
  },
  {
    name: "Barbell Shrug",
    muscleGroups: [ "traps" ],
    equipment: "barbell"
  },
  {
    name: "Dumbbell Shrug",
    muscleGroups: [ "traps" ],
    equipment: "dumbbell"
  },
  {
    name: "Back Extension",
    muscleGroups: [
      "lower back",
      "glutes",
      "hamstrings"
    ],
    equipment: "bodyweight"
  },
  {
    name: "Good Morning",
    muscleGroups: [
      "hamstrings",
      "lower back",
      "glutes"
    ],
    equipment: "barbell"
  },

  // Shoulders
  {
    name: "Overhead Press",
    muscleGroups: [ "shoulders", "triceps" ],
    equipment: "barbell"
  },
  {
    name: "Push Press",
    muscleGroups: [
      "shoulders",
      "triceps",
      "quads"
    ],
    equipment: "barbell"
  },
  {
    name: "Seated Dumbbell Shoulder Press",
    muscleGroups: [ "shoulders", "triceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Arnold Press",
    muscleGroups: [ "shoulders", "triceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Machine Shoulder Press",
    muscleGroups: [ "shoulders", "triceps" ],
    equipment: "machine"
  },
  {
    name: "Dumbbell Lateral Raise",
    muscleGroups: [ "shoulders" ],
    equipment: "dumbbell"
  },
  {
    name: "Cable Lateral Raise",
    muscleGroups: [ "shoulders" ],
    equipment: "cable"
  },
  {
    name: "Machine Lateral Raise",
    muscleGroups: [ "shoulders" ],
    equipment: "machine"
  },
  {
    name: "Dumbbell Front Raise",
    muscleGroups: [ "shoulders" ],
    equipment: "dumbbell"
  },
  {
    name: "Reverse Dumbbell Fly",
    muscleGroups: [ "rear delts", "back" ],
    equipment: "dumbbell"
  },
  {
    name: "Reverse Pec Deck",
    muscleGroups: [ "rear delts", "back" ],
    equipment: "machine"
  },
  {
    name: "Face Pull",
    muscleGroups: [ "rear delts", "traps" ],
    equipment: "cable"
  },
  {
    name: "Upright Row",
    muscleGroups: [ "shoulders", "traps" ],
    equipment: "barbell"
  },
  {
    name: "Landmine Press",
    muscleGroups: [
      "shoulders",
      "chest",
      "triceps"
    ],
    equipment: "barbell"
  },

  // Arms
  {
    name: "Barbell Curl",
    muscleGroups: [ "biceps" ],
    equipment: "barbell"
  },
  {
    name: "EZ-Bar Curl",
    muscleGroups: [ "biceps" ],
    equipment: "ez bar"
  },
  {
    name: "Dumbbell Curl",
    muscleGroups: [ "biceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Hammer Curl",
    muscleGroups: [ "biceps", "forearms" ],
    equipment: "dumbbell"
  },
  {
    name: "Incline Dumbbell Curl",
    muscleGroups: [ "biceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Preacher Curl",
    muscleGroups: [ "biceps" ],
    equipment: "ez bar"
  },
  {
    name: "Concentration Curl",
    muscleGroups: [ "biceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Cable Curl",
    muscleGroups: [ "biceps" ],
    equipment: "cable"
  },
  {
    name: "Reverse Curl",
    muscleGroups: [ "forearms", "biceps" ],
    equipment: "ez bar"
  },
  {
    name: "Wrist Curl",
    muscleGroups: [ "forearms" ],
    equipment: "dumbbell"
  },
  {
    name: "Triceps Pushdown",
    muscleGroups: [ "triceps" ],
    equipment: "cable"
  },
  {
    name: "Rope Triceps Pushdown",
    muscleGroups: [ "triceps" ],
    equipment: "cable"
  },
  {
    name: "Overhead Cable Triceps Extension",
    muscleGroups: [ "triceps" ],
    equipment: "cable"
  },
  {
    name: "Overhead Dumbbell Triceps Extension",
    muscleGroups: [ "triceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Skull Crusher",
    muscleGroups: [ "triceps" ],
    equipment: "ez bar"
  },
  {
    name: "Dumbbell Kickback",
    muscleGroups: [ "triceps" ],
    equipment: "dumbbell"
  },
  {
    name: "Bench Dip",
    muscleGroups: [ "triceps" ],
    equipment: "bodyweight"
  },

  // Legs
  {
    name: "Barbell Back Squat",
    muscleGroups: [
      "quads",
      "glutes",
      "adductors"
    ],
    equipment: "barbell"
  },
  {
    name: "Front Squat",
    muscleGroups: [
      "quads",
      "glutes",
      "abs"
    ],
    equipment: "barbell"
  },
  {
    name: "Box Squat",
    muscleGroups: [
      "quads",
      "glutes",
      "hamstrings"
    ],
    equipment: "barbell"
  },
  {
    name: "Goblet Squat",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Hack Squat",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "machine"
  },
  {
    name: "Smith Machine Squat",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "smith machine"
  },
  {
    name: "Leg Press",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "machine"
  },
  {
    name: "Bulgarian Split Squat",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Walking Lunge",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Reverse Lunge",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Step-Up",
    muscleGroups: [ "quads", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Leg Extension",
    muscleGroups: [ "quads" ],
    equipment: "machine"
  },
  {
    name: "Romanian Deadlift",
    muscleGroups: [
      "hamstrings",
      "glutes",
      "lower back"
    ],
    equipment: "barbell"
  },
  {
    name: "Dumbbell Romanian Deadlift",
    muscleGroups: [ "hamstrings", "glutes" ],
    equipment: "dumbbell"
  },
  {
    name: "Stiff-Leg Deadlift",
    muscleGroups: [ "hamstrings", "lower back" ],
    equipment: "barbell"
  },
  {
    name: "Lying Leg Curl",
    muscleGroups: [ "hamstrings" ],
    equipment: "machine"
  },
  {
    name: "Seated Leg Curl",
    muscleGroups: [ "hamstrings" ],
    equipment: "machine"
  },
  {
    name: "Nordic Curl",
    muscleGroups: [ "hamstrings" ],
    equipment: "bodyweight"
  },
  {
    name: "Barbell Hip Thrust",
    muscleGroups: [ "glutes", "hamstrings" ],
    equipment: "barbell"
  },
  {
    name: "Glute Bridge",
    muscleGroups: [ "glutes" ],
    equipment: "bodyweight"
  },
  {
    name: "Cable Pull-Through",
    muscleGroups: [ "glutes", "hamstrings" ],
    equipment: "cable"
  },
  {
    name: "Hip Abduction Machine",
    muscleGroups: [ "abductors", "glutes" ],
    equipment: "machine"
  },
  {
    name: "Hip Adduction Machine",
    muscleGroups: [ "adductors" ],
    equipment: "machine"
  },
  {
    name: "Standing Calf Raise",
    muscleGroups: [ "calves" ],
    equipment: "machine"
  },
  {
    name: "Seated Calf Raise",
    muscleGroups: [ "calves" ],
    equipment: "machine"
  },
  {
    name: "Leg Press Calf Raise",
    muscleGroups: [ "calves" ],
    equipment: "machine"
  },
  {
    name: "Kettlebell Swing",
    muscleGroups: [
      "glutes",
      "hamstrings",
      "lower back"
    ],
    equipment: "kettlebell"
  },

  // Core
  {
    name: "Plank",
    muscleGroups: [ "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Side Plank",
    muscleGroups: [ "obliques", "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Hanging Leg Raise",
    muscleGroups: [ "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Hanging Knee Raise",
    muscleGroups: [ "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Cable Crunch",
    muscleGroups: [ "abs" ],
    equipment: "cable"
  },
  {
    name: "Crunch",
    muscleGroups: [ "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Ab Wheel Rollout",
    muscleGroups: [ "abs" ],
    equipment: "other"
  },
  {
    name: "Russian Twist",
    muscleGroups: [ "obliques", "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Pallof Press",
    muscleGroups: [ "obliques", "abs" ],
    equipment: "cable"
  },
  {
    name: "Dead Bug",
    muscleGroups: [ "abs" ],
    equipment: "bodyweight"
  },
  {
    name: "Farmer's Carry",
    muscleGroups: [
      "forearms",
      "traps",
      "abs"
    ],
    equipment: "dumbbell"
  }
];
