/** Default exercise library, seeded on first launch (Strong-style basics). */
import type { BodyPart, Equipment, Exercise } from "../types";

const LIB: [string, BodyPart, Equipment][] = [
  ["Bench Press", "chest", "barbell"],
  ["Incline Bench Press", "chest", "barbell"],
  ["Dumbbell Bench Press", "chest", "dumbbell"],
  ["Chest Fly", "chest", "machine"],
  ["Push Up", "chest", "bodyweight"],
  ["Squat", "legs", "barbell"],
  ["Front Squat", "legs", "barbell"],
  ["Leg Press", "legs", "machine"],
  ["Romanian Deadlift", "legs", "barbell"],
  ["Leg Extension", "legs", "machine"],
  ["Leg Curl", "legs", "machine"],
  ["Calf Raise", "legs", "machine"],
  ["Lunge", "legs", "dumbbell"],
  ["Deadlift", "back", "barbell"],
  ["Barbell Row", "back", "barbell"],
  ["Pull Up", "back", "bodyweight"],
  ["Chin Up", "back", "bodyweight"],
  ["Lat Pulldown", "back", "cable"],
  ["Seated Cable Row", "back", "cable"],
  ["Dumbbell Row", "back", "dumbbell"],
  ["Overhead Press", "shoulders", "barbell"],
  ["Dumbbell Shoulder Press", "shoulders", "dumbbell"],
  ["Lateral Raise", "shoulders", "dumbbell"],
  ["Face Pull", "shoulders", "cable"],
  ["Rear Delt Fly", "shoulders", "dumbbell"],
  ["Barbell Curl", "arms", "barbell"],
  ["Dumbbell Curl", "arms", "dumbbell"],
  ["Hammer Curl", "arms", "dumbbell"],
  ["Triceps Pushdown", "arms", "cable"],
  ["Skull Crusher", "arms", "barbell"],
  ["Dip", "arms", "bodyweight"],
  ["Plank", "core", "bodyweight"],
  ["Crunch", "core", "bodyweight"],
  ["Hanging Leg Raise", "core", "bodyweight"],
  ["Cable Crunch", "core", "cable"],
  ["Russian Twist", "core", "bodyweight"],
];

export function seedExercises(now: number): Exercise[] {
  return LIB.map(([name, bodyPart, equipment], i) => ({
    // Stable ids so two fresh devices seed identical rows and sync merges them.
    id: `seed-${i}-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    bodyPart,
    equipment,
    updatedAt: now,
  }));
}
