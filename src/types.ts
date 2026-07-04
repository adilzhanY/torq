/**
 * Torq domain types — a Strong-style workout tracker.
 * Every synced row carries `id` + `updatedAt` (epoch ms) for last-write-wins
 * delta sync (see lib/sync.ts and supabase/schema.sql).
 */

export type Unit = "kg" | "lb";

export type SetType = "normal" | "warmup" | "drop" | "failure";

export type BodyPart =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "olympic"
  | "cardio"
  | "other";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

/** One movement in the library (Bench Press, Squat…). */
export interface Exercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  notes?: string;
  updatedAt: number;
}

/** One logged set: weight × reps (weight in the user's unit). */
export interface WorkoutSet {
  type: SetType;
  weight: number;
  reps: number;
  /** Ticked off during an active session. */
  done: boolean;
}

/** One exercise inside a workout/routine with its sets. */
export interface WorkoutEntry {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
}

/** A reusable workout template (Strong's "Routine"). */
export interface Routine {
  id: string;
  name: string;
  entries: WorkoutEntry[];
  updatedAt: number;
}

/** A logged (or in-progress) workout session. */
export interface Workout {
  id: string;
  name: string;
  /** Routine it was started from, if any. */
  routineId?: string;
  startedAt: number;
  /** Unset while the session is active. */
  endedAt?: number;
  entries: WorkoutEntry[];
  notes?: string;
  updatedAt: number;
}

/** A body measurement point (weight, body fat, chest…). */
export interface Measurement {
  id: string;
  kind: string;
  value: number;
  unit: string;
  at: number;
  updatedAt: number;
}

export interface Settings {
  id: "settings";
  name: string;
  unit: Unit;
  /** Default rest timer in seconds. */
  restSec: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  name: "",
  unit: "kg",
  restSec: 120,
  updatedAt: 0,
};

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** Total volume (weight × reps) of completed sets in a workout. */
export function workoutVolume(w: Workout): number {
  return w.entries.reduce(
    (sum, e) =>
      sum + e.sets.reduce((s, set) => s + (set.done ? set.weight * set.reps : 0), 0),
    0,
  );
}

/** Count of completed sets. */
export function workoutSets(w: Workout): number {
  return w.entries.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0);
}
