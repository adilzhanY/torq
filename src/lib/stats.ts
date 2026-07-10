/** Workout math + formatting for the post-workout summary (Strong-style). */
import type { Settings, Workout, WorkoutSet } from "../types";

/** Daily Home-dashboard goals with defaults applied. */
export function dailyGoals(settings: Settings): {
  kcal: number;
  activeMin: number;
  sets: number;
  volume: number;
} {
  return {
    kcal: settings.kcalGoal ?? 300,
    activeMin: settings.activeMinGoal ?? 60,
    sets: settings.setsGoal ?? 25,
    volume: settings.volumeGoal ?? 8000,
  };
}

/** Estimated one-rep max (Epley): weight × (1 + reps/30). */
export function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

/** Best expected weight for `reps` given a one-rep max (inverse Epley). */
export function repMax(oneRM: number, reps: number): number {
  if (oneRM <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(oneRM);
  return Math.round(oneRM / (1 + reps / 30));
}

/** Strong-style default session name from the local start hour. */
export function workoutName(atMs: number): string {
  const h = new Date(atMs).getHours();
  if (h >= 4 && h <= 11) return "Morning Workout";
  if (h >= 12 && h <= 16) return "Afternoon Workout";
  if (h >= 17 && h <= 21) return "Evening Workout";
  return "Night Workout";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Monday, 6 July 2026, 11:37" (local time, no Intl dependency). */
export function fmtLongDate(ms: number): string {
  const d = new Date(ms);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hm}`;
}

/** "51m" / "1h 12m". */
export function fmtDuration(startedAt: number, endedAt: number): string {
  const min = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
}

/**
 * Fresh (undone) sets replaying the exercise's most recent finished workout —
 * same set count and types, weights/reps/rest prefilled from last time.
 * Failure sets are not replayed (Strong-style); warmups and drop sets are.
 * Null when the exercise has no history.
 */
export function lastSetsFor(exerciseId: string, workouts: Workout[]): WorkoutSet[] | null {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (
      w.entries.some((e) => e.exerciseId === exerciseId && e.sets.length > 0) &&
      (!best || w.startedAt > best.startedAt)
    ) {
      best = w;
    }
  }
  const entry = best?.entries.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
  if (!entry) return null;
  const sets = entry.sets
    .filter((s) => s.type !== "failure")
    .map<WorkoutSet>((s) => ({
      type: s.type,
      weight: s.weight,
      reps: s.reps,
      done: false,
      ...(s.restSec != null ? { restSec: s.restSec } : {}),
    }));
  return sets.length ? sets : null;
}

export interface SetPRs {
  rm: boolean;
  weight: boolean;
  vol: boolean;
}

/**
 * Per-set personal records for one workout, judged against every earlier
 * workout (and earlier sets of the same session, so only the record-setting
 * set wears the badge). Warmup sets are ineligible, like Strong.
 */
export function computePRs(
  workout: Workout,
  allWorkouts: Workout[],
): { bySet: Map<string, SetPRs>; total: number } {
  // Running best per exercise: single-set weight, volume, est 1RM.
  const best = new Map<string, { weight: number; vol: number; rm: number }>();
  const bump = (exerciseId: string, weight: number, reps: number) => {
    const b = best.get(exerciseId) ?? { weight: 0, vol: 0, rm: 0 };
    b.weight = Math.max(b.weight, weight);
    b.vol = Math.max(b.vol, weight * reps);
    b.rm = Math.max(b.rm, est1RM(weight, reps));
    best.set(exerciseId, b);
  };

  for (const past of allWorkouts) {
    if (past.id === workout.id || past.startedAt >= workout.startedAt) continue;
    for (const e of past.entries) {
      for (const s of e.sets) {
        if (s.type === "warmup") continue;
        bump(e.exerciseId, s.weight, s.reps);
      }
    }
  }

  const bySet = new Map<string, SetPRs>();
  let total = 0;
  workout.entries.forEach((e, ei) => {
    e.sets.forEach((s, si) => {
      if (s.type === "warmup" || s.weight <= 0 || s.reps <= 0) return;
      const b = best.get(e.exerciseId) ?? { weight: 0, vol: 0, rm: 0 };
      const prs: SetPRs = {
        weight: s.weight > b.weight,
        vol: s.weight * s.reps > b.vol,
        rm: est1RM(s.weight, s.reps) > b.rm,
      };
      if (prs.weight || prs.vol || prs.rm) {
        bySet.set(`${ei}-${si}`, prs);
        total += Number(prs.weight) + Number(prs.vol) + Number(prs.rm);
      }
      bump(e.exerciseId, s.weight, s.reps);
    });
  });
  return { bySet, total };
}
