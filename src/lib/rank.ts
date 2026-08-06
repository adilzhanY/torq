/**
 * Rank engine v1 (PATH.md Phase 1, formula half of the locked hybrid):
 * every lift's best estimated 1RM becomes DOTS points — the sex+bodyweight
 * normalization powerlifting meets score with — and fixed point thresholds
 * map points onto the 9-tier ladder. The bundled OpenPowerlifting
 * percentile tables arrive later and will replace the thresholds for the
 * big lifts; until then the card claims tiers and points, never "top N%"
 * (no fake precision — locked decision).
 *
 * Rank-eligible sets (consistent with the PR engine, plus the rep cap):
 * finished workouts only, no warmups, weight > 0, reps 1–10 (Epley
 * degrades past 10 — such sets still count for PRs, just not ranks).
 */
import { est1RM } from "./stats";
import { LB_TO_KG } from "./units";
import type { Workout } from "../types";

export const TIER_NAMES = [
  "Rust",
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Elite",
  "World Class",
] as const;
export type TierName = (typeof TIER_NAMES)[number];

/** Dark-theme tier accent (text on a translucent pill of the same color). */
export const TIER_COLORS: Record<TierName, string> = {
  Rust: "#C77E4F",
  Iron: "#C3CBD4",
  Bronze: "#E8A55B",
  Silver: "#EDF2F7",
  Gold: "#E9B920",
  Platinum: "#A8D8DC",
  Diamond: "#6FA9E8",
  Elite: "#C8FE23",
  "World Class": "#9C86E8",
};

/** Compact badge label ("PLAT" style, per the rank-card concept). */
export const TIER_SHORT: Record<TierName, string> = {
  Rust: "RUST",
  Iron: "IRON",
  Bronze: "BRONZE",
  Silver: "SILVER",
  Gold: "GOLD",
  Platinum: "PLAT",
  Diamond: "DIAM",
  Elite: "ELITE",
  "World Class": "WORLD",
};

/**
 * Per-lift DOTS thresholds, calibrated against public strength-standard
 * intuition (a ~500-DOTS 3-lift total is an advanced lifter). Overall
 * thresholds are these ×3 (the overall score sums the top 3 lifts).
 */
const LIFT_MIN: { name: TierName; min: number }[] = [
  { name: "Rust", min: 0 },
  { name: "Iron", min: 30 },
  { name: "Bronze", min: 45 },
  { name: "Silver", min: 60 },
  { name: "Gold", min: 75 },
  { name: "Platinum", min: 95 },
  { name: "Diamond", min: 115 },
  { name: "Elite", min: 140 },
  { name: "World Class", min: 165 },
];

// Official DOTS polynomial coefficients (male / female).
const DOTS_M = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
const DOTS_F = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

/** DOTS points for one lift (all inputs in kg). */
export function dotsPoints(liftKg: number, bodyweightKg: number, sex: "male" | "female"): number {
  if (liftKg <= 0) return 0;
  const c = sex === "female" ? DOTS_F : DOTS_M;
  // Clamp to the formula's validated bodyweight range.
  const bw = Math.min(Math.max(bodyweightKg, 40), sex === "female" ? 150 : 210);
  const denom = c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4;
  return (liftKg * 500) / denom;
}

export type TierState = {
  tier: TierName;
  points: number;
  /** null at the top of the ladder. */
  next: TierName | null;
  /** Points still missing to the next tier (0 at World Class). */
  toNext: number;
  /** 0..1 progress through the current tier band. */
  progress: number;
};

/** Map points onto the ladder; `scale` = 1 per-lift, 3 overall. */
export function tierFor(points: number, scale: number): TierState {
  let idx = 0;
  for (let i = 0; i < LIFT_MIN.length; i++) {
    if (points >= LIFT_MIN[i].min * scale) idx = i;
  }
  const cur = LIFT_MIN[idx];
  const nxt = LIFT_MIN[idx + 1] ?? null;
  const floor = cur.min * scale;
  const ceil = nxt ? nxt.min * scale : floor;
  return {
    tier: cur.name,
    points,
    next: nxt?.name ?? null,
    toNext: nxt ? Math.max(0, ceil - points) : 0,
    progress: nxt ? Math.min(1, Math.max(0, (points - floor) / (ceil - floor))) : 1,
  };
}

export type BestLift = {
  exerciseId: string;
  /** Best rank-eligible e1RM in the DISPLAY unit (for the card). */
  e1RM: number;
  points: number;
  tier: TierState;
};

/**
 * Best rank-eligible e1RM per exercise across all finished workouts,
 * scored and sorted by points (descending).
 */
export function rankLifts(
  workouts: Workout[],
  unit: string,
  bodyweightKg: number,
  sex: "male" | "female",
): BestLift[] {
  const toKg = unit === "lb" ? LB_TO_KG : 1;
  const best = new Map<string, number>(); // exerciseId → best e1RM (display unit)
  for (const w of workouts) {
    if (!w.endedAt) continue;
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (s.type === "warmup" || s.weight <= 0 || s.reps <= 0 || s.reps > 10) continue;
        const rm = est1RM(s.weight, s.reps);
        if (rm > (best.get(e.exerciseId) ?? 0)) best.set(e.exerciseId, rm);
      }
    }
  }
  const lifts: BestLift[] = [];
  for (const [exerciseId, e1RM] of best) {
    const points = dotsPoints(e1RM * toKg, bodyweightKg, sex);
    lifts.push({ exerciseId, e1RM, points, tier: tierFor(points, 1) });
  }
  return lifts.sort((a, b) => b.points - a.points);
}

export type OverallRank = {
  state: TierState;
  /** The lifts the overall score is built from (top 3 by points). */
  counted: BestLift[];
};

/** Overall rank: sum of the top 3 lifts' points on the ×3 ladder. */
export function overallRank(lifts: BestLift[]): OverallRank {
  const counted = lifts.slice(0, 3);
  const points = counted.reduce((s, l) => s + l.points, 0);
  return { state: tierFor(points, 3), counted };
}
