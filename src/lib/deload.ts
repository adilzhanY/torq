/**
 * Fatigue check: when the whole week is stalling, not just one lift.
 *
 * `suggest.ts` already answers "is THIS lift stuck?" every time a session is
 * prefilled, and quietly deloads it. What nobody was watching is the pattern
 * ACROSS lifts. One stalled lift is a normal week. Most of your lifts stalling
 * at once is systemic fatigue, and the answer to that is not a per-exercise
 * 10% cut, it is a lighter week.
 *
 * Deliberately conservative. A false "you need a deload" teaches people to
 * ignore the card, so this needs a majority of tracked lifts to be stuck
 * inside a recent window before it says anything at all, and it stays silent
 * until there is enough history for "stuck" to mean something.
 */
import type { Exercise, Workout } from "../types";

/** How far back a stall has to have happened to still count. */
export const WINDOW_DAYS = 14;
/** Sessions of a lift needed before its stall is meaningful at all. */
const MIN_SESSIONS = 3;
/** Fraction of tracked lifts that must be stuck. */
const MAJORITY = 0.5;
/** Lifts needed before the check runs, so a two-exercise week cannot trip it. */
const MIN_TRACKED = 3;
/** What a deload week loads, as a fraction of normal working weights. */
export const DELOAD_FACTOR = 0.85;

export interface FatigueCheck {
  /** Exercise names that are stuck, most recently trained first. */
  stalled: string[];
  /** How many lifts had enough history to judge. */
  tracked: number;
  /** True when a deload is worth proposing. */
  recommend: boolean;
}

/**
 * Which lifts are stuck, and whether that is enough to suggest easing off.
 *
 * "Stuck" is defined on the WEIGHT TREND: the top working weight has not
 * moved up across the lift's last three sessions.
 *
 * The first version asked `suggestWeight` instead, on the theory that reusing
 * the prefill engine would keep the card and the logger in agreement. A test
 * killed it: that engine needs the PRESCRIBED rep target, and the only target
 * available here is the reps you actually did, so "did you hit the target"
 * was true by construction and nothing ever looked stalled. Weight trend
 * needs no target, and it is also what a lifter means by stuck.
 */
export function fatigueCheck(
  workouts: Workout[],
  exercises: Exercise[],
  nowMs: number,
): FatigueCheck {
  const cutoff = nowMs - WINDOW_DAYS * 86400_000;
  const finished = workouts.filter((w) => w.endedAt);

  // Only lifts trained inside the window can be stalling NOW. A lift you
  // stopped doing in March is not fatigue, it is a change of programme.
  const recent = new Map<string, number>();
  for (const w of finished) {
    if ((w.endedAt ?? 0) < cutoff) continue;
    for (const e of w.entries) {
      const worked = e.sets.some((s) => s.done && s.type !== "warmup" && s.weight > 0);
      if (worked) recent.set(e.exerciseId, Math.max(recent.get(e.exerciseId) ?? 0, w.endedAt ?? 0));
    }
  }

  const stalled: { name: string; at: number }[] = [];
  let tracked = 0;

  for (const [exerciseId, at] of recent) {
    // Top working weight per session, newest first.
    const tops = finished
      .map((w) => {
        const sets = (w.entries.find((e) => e.exerciseId === exerciseId)?.sets ?? [])
          .filter((s) => s.done && s.type !== "warmup" && s.weight > 0);
        return sets.length ? { at: w.endedAt ?? w.startedAt, top: Math.max(...sets.map((s) => s.weight)) } : null;
      })
      .filter((v): v is { at: number; top: number } => v !== null)
      .sort((a, b) => b.at - a.at);
    if (tops.length < MIN_SESSIONS) continue;

    tracked += 1;
    // No progress across the last three sessions of this lift.
    if (tops[0].top <= tops[MIN_SESSIONS - 1].top) {
      stalled.push({ name: exercises.find((e) => e.id === exerciseId)?.name ?? "Exercise", at });
    }
  }

  stalled.sort((a, b) => b.at - a.at);
  return {
    stalled: stalled.map((s) => s.name),
    tracked,
    recommend: tracked >= MIN_TRACKED && stalled.length >= Math.ceil(tracked * MAJORITY),
  };
}

/** Is a deload week currently running? */
export function deloadActive(until: number | undefined, nowMs: number): boolean {
  return !!until && until > nowMs;
}

/** Working weight during a deload week, rounded to something loadable. */
export function deloadWeight(weight: number, step: number): number {
  if (weight <= 0) return weight;
  const eased = Math.round((weight * DELOAD_FACTOR) / step) * step;
  // Never round UP into a heavier session than normal, and never below one
  // plate change: "ease off" has to actually be easier and still loadable.
  // Under two steps there is no lighter loadable weight, so the answer is
  // the weight itself: 2 kg dumbbells used to come back as 2.5 kg here.
  if (weight < 2 * step) return weight;
  return Math.max(step, Math.min(eased, weight - step));
}
