/** Unit conversions: the one home for lb/kg and ft-in/cm math. */
import type { DB } from "./db";
import type { Unit } from "../types";

/**
 * Parse what a person types into a weight or reps field. Accepts a comma
 * decimal ("1,5"), ignores stray characters, never returns a negative and
 * never NaN. `Number(v) || 0` used to turn "1,5" into 0 and a typed "-" into
 * a negative weight that flowed into volume and rank maths.
 */
export function parseNum(raw: string): number {
  const cleaned = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export const LB_TO_KG = 0.45359237;
export const CM_PER_FT = 30.48;
export const CM_PER_IN = 2.54;

export function ftInToCm(ft: number, inch: number): number {
  return Math.round(ft * CM_PER_FT + inch * CM_PER_IN);
}

/** cm → { ft, inch } with the inch remainder normalized to 0-11. */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

/** Round to what the app displays and stores (10 g / 0.01 lb). */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Convert one weight between the two display units. */
export function convertWeight(value: number, from: Unit, to: Unit): number {
  if (from === to || !Number.isFinite(value)) return value;
  return round2(from === "kg" ? value / LB_TO_KG : value * LB_TO_KG);
}

/**
 * Convert every stored weight from one unit to the other. Weights live in
 * the user's unit by design (types.ts), which is fine until the unit
 * changes: before 2026-09-04 flipping kg/lb in Settings rewrote nothing and
 * every 100 kg set became a 100 lb set. Returns NEW arrays so memoised
 * consumers notice. `settings.weightKg` is already kg and is left alone.
 */
export function convertDB(db: DB, from: Unit, to: Unit): DB {
  if (from === to) return db;
  const set = <S extends { weight: number }>(s: S): S => ({ ...s, weight: convertWeight(s.weight, from, to) });
  const entries = <E extends { sets: { weight: number }[] }>(e: E): E => ({ ...e, sets: e.sets.map(set) });
  const workout = <W extends { entries: { sets: { weight: number }[] }[] }>(w: W): W => ({
    ...w,
    entries: w.entries.map(entries),
  });
  return {
    ...db,
    workouts: db.workouts.map(workout),
    routines: db.routines.map(workout),
    activeWorkout: db.activeWorkout ? workout(db.activeWorkout) : null,
    measurements: db.measurements.map((m) =>
      m.unit === from ? { ...m, unit: to, value: convertWeight(m.value, from, to) } : m,
    ),
    settings: {
      ...db.settings,
      unit: to,
      barWeight: db.settings.barWeight == null ? undefined : convertWeight(db.settings.barWeight, from, to),
      plates: db.settings.plates?.map((p) => convertWeight(p, from, to)),
    },
  };
}
