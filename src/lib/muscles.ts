/**
 * Muscle rollups: what a session trains, and what is still recovering.
 *
 * Both exist for the Home rebuild (Adilzhan picked "Today, full-bleed" from
 * the lavish review `.lavish/torq-home.html`, 2026-08-09). The old Home told
 * you "Rest day" and nothing else; a rest day is only meaningful if it says
 * WHAT is resting, and a training day is only useful if it says what it is
 * about to hit.
 *
 * Ordered by SET COUNT rather than by volume: a session's identity is what
 * you spent your sets on, and volume (the thing this redesign is deleting
 * from Home) would let one heavy squat outrank six shoulder movements.
 */
import type { BodyPart, Exercise, Routine, Workout } from "../types";

const DAY = 86400000;

/** Pretty label for a body part ("legs" → "Legs"). */
export function partLabel(p: BodyPart): string {
  return p[0].toUpperCase() + p.slice(1);
}

/**
 * The body parts a routine trains, most-worked first. `limit` keeps it to
 * the few that define the session. A chip row is a headline, not an index.
 */
export function routineMuscles(
  routine: Routine,
  exercises: Exercise[],
  limit = 3,
): BodyPart[] {
  const partOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const sets = new Map<BodyPart, number>();
  for (const entry of routine.entries) {
    const part = partOf.get(entry.exerciseId);
    if (!part) continue;
    sets.set(part, (sets.get(part) ?? 0) + entry.sets.length);
  }
  return [...sets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([part]) => part);
}

export interface Recovering {
  part: BodyPart;
  /** Whole days since the last finished workout that worked it. */
  days: number;
}

/**
 * What you trained recently and how long ago, most recent first, the rest
 * day's "recovering" chips.
 *
 * Only WORKING sets count: a warmup does not fatigue a muscle group in any
 * way worth reporting, and counting them would call a group "trained" on the
 * strength of two empty-bar reps.
 */
export function recovering(
  workouts: Workout[],
  exercises: Exercise[],
  nowMs: number,
  limit = 3,
): Recovering[] {
  const partOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const last = new Map<BodyPart, number>();

  for (const w of workouts) {
    if (!w.endedAt) continue;
    for (const entry of w.entries) {
      const part = partOf.get(entry.exerciseId);
      if (!part) continue;
      const worked = entry.sets.some((s) => s.done && s.type !== "warmup");
      if (!worked) continue;
      if (w.endedAt > (last.get(part) ?? 0)) last.set(part, w.endedAt);
    }
  }

  return [...last.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([part, at]) => ({
      part,
      days: Math.max(0, Math.floor((nowMs - at) / DAY)),
    }));
}

/**
 * Short tag for a plan day's routine ("Push Day" → "PUSH"), for the week
 * strip. Falls back to the body part when the name carries no useful first
 * word, so "Upper A" stays "UPPER" but an unnamed routine still says
 * something.
 */
export function sessionTag(routine: Routine, exercises: Exercise[]): string {
  const first = routine.name.trim().split(/\s+/)[0] ?? "";
  const cleaned = first.replace(/[^A-Za-z]/g, "");
  if (cleaned.length >= 3) return cleaned.slice(0, 5).toUpperCase();
  const [part] = routineMuscles(routine, exercises, 1);
  return part ? part.slice(0, 5).toUpperCase() : "TRAIN";
}

/**
 * The body parts a FINISHED workout actually worked, most-worked first,
 * the History timeline's chips.
 *
 * Counts only ticked, non-warmup sets: a session where you racked the bar
 * after two warmups did not train that muscle, and saying it did would make
 * the log lie about the one thing it exists to record.
 */
export function workoutMuscles(
  workout: Workout,
  exercises: Exercise[],
  limit = 3,
): BodyPart[] {
  const partOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const sets = new Map<BodyPart, number>();
  for (const entry of workout.entries) {
    const part = partOf.get(entry.exerciseId);
    if (!part) continue;
    const n = entry.sets.filter((s) => s.done && s.type !== "warmup").length;
    if (n > 0) sets.set(part, (sets.get(part) ?? 0) + n);
  }
  return [...sets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([part]) => part);
}
