/**
 * Plate math: what to actually put on the bar.
 *
 * The app has always known the NUMBER. Standing at the rack you need the
 * LOADOUT, and doing that arithmetic in your head between sets is the most
 * common piece of mental work a lifter does. It is also the piece an app can
 * remove completely.
 *
 * This is the core of the "gym profiles" feature: the bar and the plate set
 * are the two facts that differ between gyms, and they are all the maths
 * needs. Per-gym profiles (several saved sets, machine filtering) build on
 * top of these same functions later.
 *
 * GREEDY IS OPTIMAL HERE, which is not true of coin problems generally: real
 * plate sets are each at least half the next one up (25/20/15/10/5/2.5/1.25),
 * so taking the heaviest that fits can never strand a remainder a different
 * choice would have covered.
 */
import type { Unit } from "../types";

/** Standard olympic bar. */
export const BAR: Record<Unit, number> = { kg: 20, lb: 45 };

/** What a well-stocked gym has, heaviest first, as PAIRS. */
export const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export interface Loadout {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs once loaded. */
  total: number;
  /** True when `total` hits the target exactly. */
  exact: boolean;
  /** Signed miss, target - total. Negative means the bar is heavier. */
  off: number;
}

/**
 * How to load `target` on a bar, or null when a bar cannot make it at all
 * (a dumbbell press, a machine, or anything under the empty bar).
 */
export function loadout(target: number, bar: number, plates: number[]): Loadout | null {
  if (!(target > 0) || !(bar > 0) || target < bar) return null;
  let side = (target - bar) / 2;
  const perSide: number[] = [];
  // A tiny epsilon because 2.5 kg plates and 0.1 kg arithmetic do not mix.
  const EPS = 1e-6;
  for (const plate of [...plates].sort((a, b) => b - a)) {
    while (side + EPS >= plate) {
      perSide.push(plate);
      side -= plate;
    }
  }
  const total = bar + perSide.reduce((n, p) => n + p, 0) * 2;
  const off = Math.round((target - total) * 100) / 100;
  return { perSide, total, exact: Math.abs(off) < 0.01, off };
}

/** "20 · 10 · 5 · 1.25" for one side, or "bar only". */
export function loadoutText(l: Loadout): string {
  return l.perSide.length ? l.perSide.join(" · ") : "bar only";
}

/**
 * The nearest weight this bar and plate set CAN make, at or below the target.
 *
 * Used to snap suggestions to reality: proposing 91.3 kg to someone whose gym
 * jumps in 2.5 kg steps is a number they cannot load, and rounding UP would
 * quietly make the session harder than the engine intended.
 */
export function nearestLoadable(target: number, bar: number, plates: number[]): number | null {
  const l = loadout(target, bar, plates);
  return l ? l.total : null;
}

/** The smallest jump this plate set allows, which is twice its lightest plate. */
export function smallestJump(plates: number[]): number {
  if (plates.length === 0) return 0;
  return Math.min(...plates) * 2;
}
