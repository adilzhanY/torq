/**
 * Wrapped: a month of training, reduced to the five numbers worth posting.
 *
 * Every figure here already existed somewhere in the app. What was missing
 * was a place that says "this is what the month WAS", in one screen, at a
 * moment when you are proud of it. That is also the only feature on the slate
 * that markets the app for you when it gets posted.
 *
 * Deliberately NOT a dashboard: five numbers, chosen because each one is a
 * sentence about the person rather than about the data. Sessions is showing
 * up. Rank gain is getting stronger. The moved lifts are what changed.
 * Records are the moments. The best session is the story.
 */
import { est1RM, prTotals } from "./stats";
import { pointsPerWorkout } from "./progress";
import type { BodyAt } from "./progress";
import type { Exercise, Unit, Workout } from "../types";

export interface LiftMove {
  name: string;
  /** Best estimated 1RM before the window, in the display unit. */
  from: number;
  /** Best estimated 1RM by the end of it. */
  to: number;
  /** to - from, positive only: a lift that did not move is not in this list. */
  delta: number;
}

export interface Wrapped {
  /** Inclusive start and exclusive end of the window, epoch ms. */
  from: number;
  to: number;
  label: string;
  sessions: number;
  sets: number;
  /** DOTS points gained inside the window. */
  rankGain: number;
  /** Personal records set inside the window. */
  records: number;
  /** Lifts that went up, biggest jump first. */
  moved: LiftMove[];
  /** The session with the most records, then the most sets. */
  best: { name: string; at: number; records: number; sets: number } | null;
  /** True when there is not enough here to be worth showing. */
  empty: boolean;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];

/** The month containing `ms`, as [start, end). */
export function monthRange(ms: number): { from: number; to: number; label: string } {
  const d = new Date(ms);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { from, to, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}

/** Best estimated 1RM per exercise across the given workouts. */
function bests(workouts: Workout[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.entries) {
      for (const s of e.sets) {
        // Same eligibility as the rank engine: real working sets only, and
        // nothing above 10 reps, where the 1RM estimate stops meaning much.
        if (s.type === "warmup" || s.weight <= 0 || s.reps <= 0 || s.reps > 10) continue;
        const rm = est1RM(s.weight, s.reps);
        if (rm > (out.get(e.exerciseId) ?? 0)) out.set(e.exerciseId, rm);
      }
    }
  }
  return out;
}

export function wrappedFor(
  workouts: Workout[],
  exercises: Exercise[],
  unit: Unit,
  bodyAt: (ms: number) => BodyAt,
  range: { from: number; to: number; label: string },
): Wrapped {
  const finished = workouts.filter((w) => w.endedAt);
  const inside = finished.filter((w) => {
    const at = w.endedAt ?? w.startedAt;
    return at >= range.from && at < range.to;
  });
  const before = finished.filter((w) => (w.endedAt ?? w.startedAt) < range.from);

  const sets = inside.reduce(
    (n, w) => n + w.entries.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0),
    0,
  );

  // One chronological pass each, as everywhere else in the app.
  const prs = prTotals(workouts);
  const points = pointsPerWorkout(workouts, unit, bodyAt);
  const records = inside.reduce((n, w) => n + (prs.get(w.id) ?? 0), 0);
  const rankGain = inside.reduce((n, w) => n + (points.get(w.id) ?? 0), 0);

  const wasBest = bests(before);
  const nowBest = bests([...before, ...inside]);
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const moved: LiftMove[] = [];
  for (const [id, to] of nowBest) {
    const from = wasBest.get(id) ?? 0;
    // A lift's DEBUT is not a jump from zero: showing "+120 kg" for the first
    // time you ever benched would be the chart lying about a beginner.
    if (from <= 0 || to <= from) continue;
    moved.push({ name: name(id), from: Math.round(from), to: Math.round(to), delta: Math.round(to - from) });
  }
  moved.sort((a, b) => b.delta - a.delta);

  let best: Wrapped["best"] = null;
  for (const w of inside) {
    const r = prs.get(w.id) ?? 0;
    const n = w.entries.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0);
    if (!best || r > best.records || (r === best.records && n > best.sets)) {
      best = { name: w.name, at: w.endedAt ?? w.startedAt, records: r, sets: n };
    }
  }

  return {
    from: range.from,
    to: range.to,
    label: range.label,
    sessions: inside.length,
    sets,
    rankGain: Math.round(rankGain),
    records,
    moved,
    best,
    // One session is a workout, not a month worth wrapping.
    empty: inside.length < 2,
  };
}
