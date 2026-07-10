/**
 * Plan-aware training streak — measures adherence, not raw day counts:
 *
 *  - Every day with a finished workout adds 1 (multiple sessions in a day
 *    still count once; bonus rest-day workouts count too).
 *  - The streak breaks after 3 CONSECUTIVE missed planned days (weekdays
 *    of the current plan routines). Scattered single misses are tolerated
 *    — a completed workout resets the miss counter.
 *  - Rest days are neutral. Today's still-pending session is not a miss
 *    until the day ends. Days before the first workout never count.
 *  - No plan → no streak (nothing honest to break it against).
 *
 * Pure function of (workouts, routines): nothing stored, nothing synced.
 * Rebuilding the plan re-judges history against the NEW weekdays — the
 * number may shift slightly; accepted, plan history isn't stored.
 */
import type { Routine, Workout } from "../types";

const MISS_LIMIT = 3;

export interface Streak {
  /** Workout-days in the live streak (0 = no live streak). */
  current: number;
  /** Best streak ever, including the current one. */
  longest: number;
  /** Live streak has 2 consecutive planned misses — one more kills it. */
  atRisk: boolean;
  /** First workout-day of the live streak (null when current = 0). */
  startedAt: number | null;
  /** There is a plan to measure against (pill hidden otherwise). */
  hasPlan: boolean;
}

/** Local midnight `n` days after the given local midnight (DST-safe). */
function addDays(dayMs: number, n: number): number {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

export function computeStreak(
  workouts: Workout[],
  routines: Routine[],
  nowMs: number,
): Streak {
  const plannedWeekdays = new Set(
    routines.filter((r) => r.plan && !r.archived && r.weekday != null).map((r) => r.weekday),
  );
  const none: Streak = { current: 0, longest: 0, atRisk: false, startedAt: null, hasPlan: false };
  if (plannedWeekdays.size === 0) return none;

  const workoutDays = new Set(
    workouts.filter((w) => w.endedAt).map((w) => new Date(w.startedAt).setHours(0, 0, 0, 0)),
  );
  if (workoutDays.size === 0) return { ...none, hasPlan: true };

  const today = new Date(nowMs).setHours(0, 0, 0, 0);
  const firstDay = Math.min(...workoutDays);

  let count = 0;
  let misses = 0;
  let start: number | null = null;
  let longest = 0;

  for (let day = firstDay; day <= today; day = addDays(day, 1)) {
    if (workoutDays.has(day)) {
      if (count === 0) start = day;
      count += 1;
      misses = 0;
    } else if (day < today && plannedWeekdays.has(new Date(day).getDay())) {
      // A planned day with nothing logged; today stays pending, not missed.
      misses += 1;
      if (misses >= MISS_LIMIT) {
        longest = Math.max(longest, count);
        count = 0;
        misses = 0;
        start = null;
      }
    }
  }

  longest = Math.max(longest, count);
  return {
    current: count,
    longest,
    atRisk: count > 0 && misses === MISS_LIMIT - 1,
    startedAt: count > 0 ? start : null,
    hasPlan: true,
  };
}
