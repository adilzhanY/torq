/**
 * Recommended routines shown on the Workout tab — a classic 3-day
 * push/pull/legs split built from ExerciseDB catalog exercises (dbIds
 * reference src/data/exercisedb.json). Starting one imports any missing
 * exercises into the user's library and opens a live session with the
 * planned sets prefilled.
 */

export interface RecommendedItem {
  dbId: string;
  sets: number;
  reps: number;
}

export interface RecommendedRoutine {
  name: string;
  blurb: string;
  items: RecommendedItem[];
}

export const RECOMMENDED: RecommendedRoutine[] = [
  {
    name: "Push Day",
    blurb: "Chest, shoulders & triceps — day 1 of a 3-day split.",
    items: [
      { dbId: "EIeI8Vf", sets: 4, reps: 8 },  // barbell bench press
      { dbId: "3TZduzM", sets: 3, reps: 10 }, // barbell incline bench press
      { dbId: "znQUdHY", sets: 3, reps: 10 }, // dumbbell seated shoulder press
      { dbId: "DsgkuIt", sets: 3, reps: 12 }, // dumbbell lateral raise
      { dbId: "3ZflifB", sets: 3, reps: 12 }, // cable pushdown
    ],
  },
  {
    name: "Pull Day",
    blurb: "Back & biceps — day 2 of a 3-day split.",
    items: [
      { dbId: "ila4NZS", sets: 3, reps: 5 },  // barbell deadlift
      { dbId: "lBDjFxJ", sets: 3, reps: 8 },  // pull-up
      { dbId: "RVwzP10", sets: 3, reps: 10 }, // cable pulldown
      { dbId: "fUBheHs", sets: 3, reps: 10 }, // cable seated row
      { dbId: "25GPyDY", sets: 3, reps: 12 }, // barbell curl
    ],
  },
  {
    name: "Leg Day",
    blurb: "Quads, hamstrings & calves — day 3 of a 3-day split.",
    items: [
      { dbId: "qXTaZnJ", sets: 4, reps: 8 },  // barbell full squat
      { dbId: "wQ2c4XD", sets: 3, reps: 10 }, // barbell romanian deadlift
      { dbId: "my33uHU", sets: 3, reps: 12 }, // lever leg extension
      { dbId: "17lJ1kr", sets: 3, reps: 12 }, // lever lying leg curl
      { dbId: "8ozhUIZ", sets: 4, reps: 15 }, // barbell standing calf raise
    ],
  },
];
