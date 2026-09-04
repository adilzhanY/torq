/**
 * Ghost mode: race the last time you did this session.
 *
 * The live logger already shows what you did last time PER SET, in the
 * PREVIOUS column. What it never showed is whether you are AHEAD, which is
 * the question people actually care about mid-session. A ghost turns a form
 * you are filling in into a race you are running, using data the app has had
 * all along.
 *
 * "By this point" is defined per SET INDEX, not by wall clock: the ghost's
 * set 3 of bench is the fair comparison for your set 3 of bench, whatever
 * order you did the exercises in or how long you rested. Comparing on the
 * clock would punish you for chatting between sets, which is not the race.
 *
 * The comparator is WORK (weight x reps), the only quantity that accumulates
 * set by set and reflects both halves of a set. Note this is not a
 * contradiction of volume being cut from Home and Stats: there volume was a
 * bad measure of PROGRESS, here it is a running score inside one session.
 */
import type { Exercise, Workout, WorkoutSet } from "../types";

/**
 * A set that holds a POSITION in the race. Warm-ups do not: they are
 * preparation, and one lifter ramping in four steps against another's two
 * would misalign every comparison after it.
 */
function counts(s: WorkoutSet): boolean {
  return s.type !== "warmup";
}

function work(s: WorkoutSet): number {
  return s.weight * s.reps;
}

/**
 * The session to race against: the most recent finished workout that shares
 * this session's routine, falling back to the one sharing the most
 * exercises. The fallback matters because quick-start sessions have no
 * routine id but are often the same workout in practice.
 */
export function findGhost(workouts: Workout[], active: Workout): Workout | null {
  const finished = workouts
    .filter((w) => w.endedAt && w.id !== active.id)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  if (finished.length === 0) return null;

  if (active.routineId) {
    const sameRoutine = finished.find((w) => w.routineId === active.routineId);
    if (sameRoutine) return sameRoutine;
  }

  const wanted = new Set(active.entries.map((e) => e.exerciseId));
  if (wanted.size === 0) return null;
  let best: Workout | null = null;
  let bestShared = 0;
  for (const w of finished) {
    const shared = new Set(w.entries.map((e) => e.exerciseId).filter((id) => wanted.has(id))).size;
    // Strictly greater keeps the most RECENT of equally matching sessions,
    // since the list is already newest first.
    if (shared > bestShared) {
      best = w;
      bestShared = shared;
    }
  }
  // One shared exercise out of eight is not the same session.
  return bestShared >= Math.max(1, Math.ceil(wanted.size / 2)) ? best : null;
}

export interface GhostProgress {
  /** Work done so far this session, in the display unit. */
  done: number;
  /** What the ghost had done by the same point (same sets, same indices). */
  ghost: number;
  /** done - ghost. Positive means ahead. */
  delta: number;
  /** The ghost's total for the whole session, for context. */
  ghostTotal: number;
  /** What the ghost lifted on the set you are about to do, if it did one. */
  next: { exerciseId: string; weight: number; reps: number } | null;
}

/**
 * Where you stand against the ghost right now.
 *
 * Only sets you have TICKED count toward `done`, and only the ghost's sets at
 * those same positions count toward `ghost`, so the comparison stays fair
 * however far through the session you are.
 */
export function ghostProgress(active: Workout, ghost: Workout): GhostProgress {
  const ghostByExercise = new Map(ghost.entries.map((e) => [e.exerciseId, e.sets]));
  let done = 0;
  let ghostWork = 0;
  let next: GhostProgress["next"] = null;

  for (const entry of active.entries) {
    // Index by working sets on BOTH sides so position means the same thing.
    const theirs = (ghostByExercise.get(entry.exerciseId) ?? []).filter(counts);
    let i = 0;
    for (const set of entry.sets) {
      if (!counts(set)) continue;
      const theirSet = theirs[i];
      if (set.done) {
        done += work(set);
        if (theirSet) ghostWork += work(theirSet);
      } else if (!next && theirSet) {
        next = { exerciseId: entry.exerciseId, weight: theirSet.weight, reps: theirSet.reps };
      }
      i += 1;
    }
  }

  const ghostTotal = ghost.entries.reduce(
    (sum, e) => sum + e.sets.filter(counts).reduce((s, set) => s + work(set), 0),
    0,
  );

  return { done, ghost: ghostWork, delta: done - ghostWork, ghostTotal, next };
}

/** "Aug 3" style label for the session being raced. */
export function ghostLabel(ghost: Workout): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(ghost.endedAt ?? ghost.startedAt);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Exercise name for the ghost's next set, for the hint line. */
export function exerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? "next set";
}
