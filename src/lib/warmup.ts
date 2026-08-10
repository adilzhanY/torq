/**
 * Warm-up ramps: the maths behind the "Add warm-up sets" dialog.
 *
 * The defaults are Strong's: an empty bar for 5, then 50% × 3 and 80% × 3 of
 * the work set. That is deliberately NOT the old 40/60/80 ramp this replaced.
 * Three loaded ascending sets before every exercise is a lot of work to do
 * before the work; Strong's ramp spends its first set on the movement itself
 * (bar only) and then takes two jumps.
 *
 * There is no per-exercise default, because no honest one exists: nothing in
 * the catalog tells you whether an exercise is a heavy barbell triple or a
 * lateral raise. What the app does instead is REMEMBER. The ramp is stored
 * on the Exercise, so a percentage you tune for squats stays with squats.
 *
 * The bar row is a fixed weight, not a percentage, and that distinction is
 * the point: 50% of a 40 kg work set is 20 kg, which IS the bar, but 50% of a
 * 120 kg set is 60 kg and the bar is still 20. A ramp that cannot say "just
 * the bar" has to fake it.
 */
import type { Equipment, Unit, WarmupRow, WorkoutSet } from "../types";
import { getWeightStep } from "./suggest";

/** Strong's default ramp. */
export const DEFAULT_WARMUP: WarmupRow[] = [
  { bar: true, reps: 5 },
  { pct: 50, reps: 3 },
  { pct: 80, reps: 3 },
];

/** Standard olympic bar, in each unit (20 kg / 45 lb). */
export const BAR_WEIGHT: Record<Unit, number> = { kg: 20, lb: 45 };

function roundToStep(w: number, step: number): number {
  return Math.round((w + 1e-9) / step) * step;
}

/**
 * The weight one ramp row works out to, in the display unit. Percentages are
 * rounded to the loadable step for the equipment (2.5 kg on a barbell, 1 kg
 * on dumbbells). A warm-up you cannot actually load is not a warm-up.
 */
export function warmupWeight(
  row: WarmupRow,
  workWeight: number,
  unit: Unit,
  equipment?: Equipment,
): number {
  if (row.bar) return BAR_WEIGHT[unit];
  const step = getWeightStep(unit, equipment);
  return Math.max(step, roundToStep((workWeight * (row.pct ?? 0)) / 100, step));
}

/**
 * The ramp as real sets, ready to prepend to an exercise. Rows that land at
 * or above the work set are dropped: they are no longer a warm-up, and Strong
 * users hit this the moment a light work set makes "80%" meaningless.
 */
export function warmupSets(
  rows: WarmupRow[],
  workWeight: number,
  unit: Unit,
  equipment?: Equipment,
): WorkoutSet[] {
  const out: WorkoutSet[] = [];
  for (const row of rows) {
    const weight = warmupWeight(row, workWeight, unit, equipment);
    if (workWeight > 0 && weight >= workWeight) continue;
    if (row.reps <= 0) continue;
    out.push({ type: "warmup", weight, reps: row.reps, done: false, restSec: 60 });
  }
  return out;
}

/** Human label for the formula column ("Bar × 5", "50% × 3"). */
export function formulaLabel(row: WarmupRow): string {
  return row.bar ? `Bar × ${row.reps}` : `${row.pct ?? 0}% × ${row.reps}`;
}
