/**
 * Progress — the maths behind the Stats page rebuild (Adilzhan picked
 * "the climb + the dumbbell chart" from the lavish review
 * `.lavish/torq-stats.html`, 2026-08-09).
 *
 * The old page measured VOLUME, which is how much work you did. These
 * functions measure how STRONG YOU GOT, which is the only thing torq is
 * uniquely able to answer:
 *
 *  - `rankHistory` — DOTS points over time, so the tier ladder becomes a
 *    climb you can see rather than nine numbers you have to remember.
 *  - `liftMovement` — every lift's best e1RM then vs now, which is what
 *    makes a STALL visible. A flat row is the most useful thing a training
 *    app can tell you and nothing in torq said it before.
 *  - `recentRecords` — the PR feed. Records were previously visible only
 *    inside a workout summary that scrolls away.
 *
 * All pure and React-free, so vitest runs them directly.
 */
import { dotsPoints, tierFor, type TierState } from "./rank";
import { est1RM } from "./stats";
import { LB_TO_KG } from "./units";
import type { Workout } from "../types";

/** Body state at a moment — bodyweight moves DOTS, so it moves the line. */
export interface BodyAt {
  weightKg: number;
  sex: "male" | "female";
}

export interface RankPoint {
  at: number;
  points: number;
}

/** One workout reduced to "the best rank-eligible e1RM per exercise". */
interface Best {
  at: number;
  bests: Map<string, number>;
}

/**
 * Rank-eligible sets, matching rankLifts exactly: finished workouts only, no
 * warmups, weight > 0, reps 1–10 (Epley degrades past 10). Kept in one place
 * so the history and the current rank can never disagree.
 */
function bestsPerWorkout(workouts: Workout[]): Best[] {
  const out: Best[] = [];
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const bests = new Map<string, number>();
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (s.type === "warmup" || s.weight <= 0 || s.reps <= 0 || s.reps > 10) continue;
        const rm = est1RM(s.weight, s.reps);
        if (rm > (bests.get(e.exerciseId) ?? 0)) bests.set(e.exerciseId, rm);
      }
    }
    if (bests.size > 0) out.push({ at: w.endedAt, bests });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Overall points from a running best-per-exercise map (top 3, like overallRank). */
function pointsFrom(best: Map<string, number>, toKg: number, body: BodyAt): number {
  const scored: number[] = [];
  for (const e1RM of best.values()) {
    scored.push(dotsPoints(e1RM * toKg, body.weightKg, body.sex));
  }
  scored.sort((a, b) => b - a);
  return scored.slice(0, 3).reduce((s, p) => s + p, 0);
}

/**
 * Overall DOTS points sampled across a window.
 *
 * Bodyweight is read PER SAMPLE, not once: DOTS divides by bodyweight, so a
 * lifter who gained 5 kg without adding load genuinely scores lower, and
 * pretending otherwise would draw a flat line over a real decline.
 *
 * Cost is O(workouts + samples × exercises) — the running-best map is
 * advanced through the workouts once, not recomputed per sample, because the
 * naive version is quadratic and this runs on every Stats render.
 */
export function rankHistory(
  workouts: Workout[],
  unit: string,
  bodyAt: (ms: number) => BodyAt,
  from: number,
  to: number,
  samples = 32,
): RankPoint[] {
  if (to <= from || samples < 2) return [];
  const toKg = unit === "lb" ? LB_TO_KG : 1;
  const perWorkout = bestsPerWorkout(workouts);
  if (perWorkout.length === 0) return [];

  const running = new Map<string, number>();
  let cursor = 0;
  const out: RankPoint[] = [];
  const step = (to - from) / (samples - 1);

  for (let i = 0; i < samples; i++) {
    const at = i === samples - 1 ? to : from + i * step;
    // Fold in every workout that had finished by this instant.
    while (cursor < perWorkout.length && perWorkout[cursor].at <= at) {
      for (const [id, rm] of perWorkout[cursor].bests) {
        if (rm > (running.get(id) ?? 0)) running.set(id, rm);
      }
      cursor++;
    }
    out.push({
      at,
      points: running.size === 0 ? 0 : pointsFrom(running, toKg, bodyAt(at)),
    });
  }
  return out;
}

/** The tier band a points value falls in, plus where the bands sit. */
export interface Band {
  tier: TierState["tier"];
  /** Overall-scale floor, i.e. the per-lift threshold × 3. */
  floor: number;
}

export interface LiftMove {
  exerciseId: string;
  /** Best e1RM (display unit) as of the window's start. */
  from: number;
  /** Best e1RM (display unit) at the window's end. */
  to: number;
  /** No history before the window — `from` is its debut, not a plateau. */
  isNew: boolean;
}

/**
 * Every lift's best e1RM then vs now, strongest current first.
 *
 * A lift with no history before the window starts at its FIRST value inside
 * it and is flagged `isNew`, because drawing it from zero would claim a
 * hundred-kilo jump that never happened.
 */
export function liftMovement(
  workouts: Workout[],
  since: number,
  until: number,
): LiftMove[] {
  const perWorkout = bestsPerWorkout(workouts);
  const before = new Map<string, number>();
  const firstIn = new Map<string, number>();
  const now = new Map<string, number>();

  for (const w of perWorkout) {
    if (w.at > until) break;
    for (const [id, rm] of w.bests) {
      if (w.at <= since) {
        if (rm > (before.get(id) ?? 0)) before.set(id, rm);
      } else if (!firstIn.has(id)) {
        firstIn.set(id, rm);
      }
      if (rm > (now.get(id) ?? 0)) now.set(id, rm);
    }
  }

  const out: LiftMove[] = [];
  for (const [id, to] of now) {
    const had = before.has(id);
    const from = had ? before.get(id)! : (firstIn.get(id) ?? to);
    out.push({ exerciseId: id, from, to, isNew: !had });
  }
  return out.sort((a, b) => b.to - a.to);
}

export interface RecordEvent {
  at: number;
  exerciseId: string;
  /** The new best e1RM (display unit). */
  e1RM: number;
  /** The best before it, 0 for a first-ever entry. */
  previous: number;
}

/**
 * The e1RM record feed, newest first. Only improvements on a lift's own
 * previous best count, and a lift's FIRST appearance is not a record — it is
 * a debut, and calling it a PR would spray the feed on day one.
 */
export function recentRecords(workouts: Workout[], limit = 8): RecordEvent[] {
  const best = new Map<string, number>();
  const events: RecordEvent[] = [];
  for (const w of bestsPerWorkout(workouts)) {
    for (const [id, rm] of w.bests) {
      const prev = best.get(id);
      if (prev == null) {
        best.set(id, rm);
        continue;
      }
      if (rm > prev + 1e-9) {
        events.push({ at: w.at, exerciseId: id, e1RM: rm, previous: prev });
        best.set(id, rm);
      }
    }
  }
  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Overall tier state for a points value (the ×3 ladder). */
export function overallTier(points: number): TierState {
  return tierFor(points, 3);
}
