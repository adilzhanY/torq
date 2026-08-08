/**
 * Percentiles (PATH.md Phase 1, the OTHER half of the locked hybrid engine:
 * "real percentiles from the OpenPowerlifting open CSV dump for the big
 * barbell lifts, a calibrated points formula for the long tail").
 *
 * `src/data/percentiles.json` is built from the OpenPowerlifting dump
 * (2026-08-08: 4.0M meet results → 2.2M per-lifter bests) by
 * scratchpad/percentiles.py. Distributions are over DOTS POINTS, not kilos,
 * because DOTS already normalizes sex and bodyweight — so one curve per
 * (sex, lift) covers every weight class, and it plugs straight into the
 * points rank.ts already computes.
 *
 * HONESTY (the reason percentiles were held back until now): the population
 * is people who entered a sanctioned RAW meet. That is a stronger crowd
 * than the gym floor, so every number this module returns must be shown as
 * "of competitive lifters", never "of people". Beating 50% of competitors
 * is a much bigger deal than beating 50% of gym-goers, and the UI has to
 * say which one it means.
 */
import type { Equipment } from "../types";
import { recordLiftOf, type RecordLift } from "./records";

interface LiftTable {
  n: number;
  q: Record<string, number>;
}
interface Data {
  meta: { source: string; rows: number; note: string; built: string };
  table: Record<"male" | "female", Record<RecordLift, LiftTable>>;
}

const DATA = require("../data/percentiles.json") as Data;

export const PERCENTILE_SOURCE = DATA.meta.source;
export const PERCENTILE_BUILT = DATA.meta.built;

export interface Percentile {
  /** Share of competitors this lift beats, 1–99 (clamped at the tails). */
  percent: number;
  /** How many lifters the curve is built from. */
  sampleSize: number;
  /** True at the tails, where the honest answer is "over 99%". */
  capped: "low" | "high" | null;
}

/**
 * Where `points` (DOTS for one lift) falls in the distribution, by linear
 * interpolation between the stored breakpoints.
 */
export function percentileFor(
  lift: RecordLift,
  sex: "male" | "female",
  points: number,
): Percentile | null {
  const t = DATA.table[sex]?.[lift];
  if (!t || !(points > 0)) return null;
  const steps = Object.keys(t.q)
    .map(Number)
    .sort((a, b) => a - b);

  const lowest = t.q[String(steps[0])];
  const highest = t.q[String(steps[steps.length - 1])];
  if (points <= lowest)
    return { percent: steps[0], sampleSize: t.n, capped: "low" };
  if (points >= highest)
    return { percent: steps[steps.length - 1], sampleSize: t.n, capped: "high" };

  for (let i = 1; i < steps.length; i++) {
    const hiP = steps[i];
    const loP = steps[i - 1];
    const hiV = t.q[String(hiP)];
    const loV = t.q[String(loP)];
    if (points <= hiV) {
      const span = hiV - loV;
      const frac = span > 0 ? (points - loV) / span : 0;
      return { percent: Math.round(loP + frac * (hiP - loP)), sampleSize: t.n, capped: null };
    }
  }
  return { percent: steps[steps.length - 1], sampleSize: t.n, capped: "high" };
}

/** Percentile for a library exercise, or null when it isn't a ranked lift. */
export function percentileForExercise(
  name: string,
  equipment: Equipment,
  sex: "male" | "female",
  points: number,
): (Percentile & { lift: RecordLift }) | null {
  const lift = recordLiftOf(name, equipment);
  if (!lift) return null;
  const p = percentileFor(lift, sex, points);
  return p ? { ...p, lift } : null;
}

/** "Stronger than 62%" / "Top 3%" — the phrasing flips at the top end. */
export function percentileLabel(p: Percentile): string {
  if (p.percent >= 90) return `Top ${100 - p.percent}%`;
  return `Stronger than ${p.percent}%`;
}
