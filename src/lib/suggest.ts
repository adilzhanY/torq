/**
 * Next-weight suggestions — double progression, the way a coach runs it:
 *
 *  - Hit the target reps on every top-weight working set last session →
 *    INCREASE by one step (2.5 kg / 5 lb).
 *  - Missed last session → REPEAT the weight (keep building reps).
 *  - Missed two sessions running at the same top weight → DELOAD to ~90%
 *    (rounded to the step, always at least one step below).
 *
 * Suggestions need a prescription to judge against, so they run only when
 * a routine start has target reps but no hand-typed weights (plan routines
 * are generated weight-less). Ad-hoc exercise adds keep replaying the last
 * session verbatim — without a target, "progress" can't be judged honestly.
 * Warmup sets never count; bodyweight history (no logged weight) yields no
 * suggestion.
 */
import type { Equipment, Unit, Workout, WorkoutSet } from "../types";

export type SuggestionKind = "increase" | "repeat" | "deload";

export interface WeightSuggestion {
  kind: SuggestionKind;
  weight: number;
}

/** Smallest sensible plate jump per unit for standard equipment (barbell, machine, etc.). */
export const WEIGHT_STEP: Record<Unit, number> = { kg: 2.5, lb: 5 };

/** Micro-loading plate jump per unit for equipment that is harder to progress (dumbbell, cable, etc.). */
export const LIGHT_WEIGHT_STEP: Record<Unit, number> = { kg: 1, lb: 2 };

const LIGHT_EQUIPMENT = new Set<Equipment>(["dumbbell", "cable", "kettlebell", "band"]);

export function getWeightStep(unit: Unit, equipment?: Equipment): number {
  if (equipment && LIGHT_EQUIPMENT.has(equipment)) {
    return LIGHT_WEIGHT_STEP[unit];
  }
  return WEIGHT_STEP[unit];
}

function roundToStep(w: number, step: number): number {
  return Math.round((w + 1e-9) / step) * step;
}

/** Non-warmup sets with real load and reps. */
function workingSets(w: Workout, exerciseId: string): WorkoutSet[] {
  const entry = w.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry) return [];
  return entry.sets.filter((s) => s.type !== "warmup" && s.weight > 0 && s.reps > 0);
}

/** Every set at the session's top weight reached the target reps. */
function hitTarget(sets: WorkoutSet[], topWeight: number, targetReps: number): boolean {
  const top = sets.filter((s) => s.weight >= topWeight);
  return top.length > 0 && top.every((s) => s.reps >= targetReps);
}

/** Most common prescribed reps among non-warmup sets (the entry's target). */
export function targetRepsOf(sets: WorkoutSet[]): number {
  const counts = new Map<number, number>();
  for (const s of sets) {
    if (s.type === "warmup" || s.reps <= 0) continue;
    counts.set(s.reps, (counts.get(s.reps) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [reps, count] of counts) {
    if (count > bestCount || (count === bestCount && reps > best)) {
      best = reps;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Suggested working weight for the next session of `exerciseId` given the
 * prescribed `targetReps`. Null when there's no usable history (first time,
 * or bodyweight-only) — the caller keeps its own defaults.
 */
export function suggestWeight(
  exerciseId: string,
  targetReps: number,
  workouts: Workout[],
  unit: Unit,
  equipment?: Equipment,
): WeightSuggestion | null {
  if (targetReps <= 0) return null;
  const history = workouts
    .filter((w) => w.endedAt)
    .map((w) => ({ at: w.startedAt, sets: workingSets(w, exerciseId) }))
    .filter((h) => h.sets.length > 0)
    .sort((a, b) => b.at - a.at);
  if (history.length === 0) return null;

  const step = getWeightStep(unit, equipment);
  const [last, prev] = history;
  const topWeight = Math.max(...last.sets.map((s) => s.weight));

  if (hitTarget(last.sets, topWeight, targetReps)) {
    return { kind: "increase", weight: roundToStep(topWeight + step, step) };
  }

  // Missed last time. Two consecutive misses at the same top weight → deload.
  if (prev) {
    const prevTop = Math.max(...prev.sets.map((s) => s.weight));
    if (prevTop === topWeight && !hitTarget(prev.sets, prevTop, targetReps)) {
      const deload = Math.max(step, Math.min(roundToStep(topWeight * 0.9, step), topWeight - step));
      if (deload < topWeight) return { kind: "deload", weight: deload };
    }
  }
  return { kind: "repeat", weight: topWeight };
}
