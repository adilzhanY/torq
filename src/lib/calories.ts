/**
 * Calorie estimation — per-set work + load model on a personal BMR base.
 *
 * Resting burn comes from the Mifflin-St Jeor BMR (weight, height, age,
 * sex); a MET is a multiple of that, so time-based components are
 * `MET × restingKcal × time`. Three components per workout, all derived
 * from the sets actually completed — the wall clock is IGNORED in both
 * directions (v1 billed idle-session time: one 20kg×15 set showed 186 kcal;
 * v2 capped billing at elapsed time, which crushed backfilled workouts
 * logged in minutes: a real 22-set session showed 89 kcal. Activity only):
 *
 * 1. LIFTING WORK — moving the load. Raising 1 kg through a ~0.5 m range is
 *    ~0.0012 kcal of mechanical work; at ~20–25% muscular efficiency plus
 *    the eccentric lowering that's ≈0.008 kcal per kg·rep (matches published
 *    per-set costs for bench/squat). Bodyweight exercises count ~60% of body
 *    mass as the load (plus any logged added weight).
 * 2. TIME UNDER WORK — ~15 s setup + 4 s per rep per completed set, billed
 *    at the Compendium MET for the movement class (resistance training 3.5,
 *    olympic lifting 6, cardio 7 — the lifting itself is component 1).
 * 3. REST BETWEEN SETS — 1.8 MET (standing around) for the PLANNED rest per
 *    completed set (per-set override or the default timer, clamped 30s–4min).
 */
import { LB_TO_KG } from "./units";
import type { Exercise, Measurement, Settings, Workout } from "../types";

export interface BodyProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  /** False while any field is still a default (profile not filled in). */
  complete: boolean;
}

const DEFAULTS = { weightKg: 75, heightCm: 175, age: 25, sex: "male" as const };

/** Latest logged "Body weight" measurement at or before `atMs`, in kg. */
function measuredWeightKg(measurements: Measurement[], atMs: number): number | null {
  let best: Measurement | null = null;
  for (const m of measurements) {
    if (m.kind !== "Body weight" || m.at > atMs) continue;
    if (!best || m.at > best.at) best = m;
  }
  if (!best) return null;
  return best.unit === "lb" ? best.value * LB_TO_KG : best.value;
}

/**
 * Body profile as of `atMs` (so old workouts use the body weight logged back
 * then). Weight prefers the Measure tab's "Body weight" log, falling back to
 * the profile field; missing fields fall back to defaults with
 * `complete: false`.
 */
export function bodyProfileAt(
  settings: Settings,
  measurements: Measurement[],
  atMs: number,
): BodyProfile {
  const weightKg = measuredWeightKg(measurements, atMs) ?? settings.weightKg ?? null;
  const age = settings.birthYear
    ? Math.min(100, Math.max(10, new Date(atMs).getFullYear() - settings.birthYear))
    : null;
  return {
    weightKg: weightKg ?? DEFAULTS.weightKg,
    heightCm: settings.heightCm ?? DEFAULTS.heightCm,
    age: age ?? DEFAULTS.age,
    sex: settings.sex ?? DEFAULTS.sex,
    complete:
      weightKg != null && age != null && settings.heightCm != null && settings.sex != null,
  };
}

/** Mifflin-St Jeor basal metabolic rate, kcal/day. */
export function bmrKcalPerDay(p: BodyProfile): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
}

const REST_MET = 1.8;
/** Metabolic cost of moving 1 kg through one rep (see header). */
const KCAL_PER_KG_REP = 0.008;
/** Share of body mass moved by an unloaded bodyweight movement. */
const BODYWEIGHT_LOAD = 0.6;

function workMet(exercise: Exercise | undefined): number {
  switch (exercise?.bodyPart) {
    case "cardio": return 7;
    case "olympic": return 6;
    default: return 3.5;
  }
}

/** Estimated seconds under load for one set (setup + ~4s per rep). */
function setSeconds(reps: number): number {
  return 15 + 4 * Math.max(0, reps);
}

/**
 * Estimated calories for a workout, purely from its completed sets — live,
 * finished, and backfilled sessions are all billed the same way. `settings`
 * supplies the weight unit and the default rest timer.
 */
export function workoutCalories(
  workout: Workout,
  exercises: Exercise[],
  profile: BodyProfile,
  settings: Settings,
): number {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const toKg = settings.unit === "lb" ? LB_TO_KG : 1;

  let metWorkSec = 0; // MET-weighted work seconds
  let restSec = 0;
  let loadKcal = 0;
  let doneSets = 0;
  for (const entry of workout.entries) {
    const ex = byId.get(entry.exerciseId);
    const met = workMet(ex);
    for (const set of entry.sets) {
      if (!set.done) continue;
      doneSets += 1;
      metWorkSec += met * setSeconds(set.reps);
      restSec += Math.min(240, Math.max(30, set.restSec ?? settings.restSec));
      let loadKg = Math.max(0, set.weight) * toKg;
      if (ex?.equipment === "bodyweight") loadKg += BODYWEIGHT_LOAD * profile.weightKg;
      loadKcal += KCAL_PER_KG_REP * loadKg * Math.max(0, set.reps);
    }
  }
  if (doneSets === 0) return 0;

  const restingKcalPerSec = bmrKcalPerDay(profile) / 86400;
  return Math.round((metWorkSec + REST_MET * restSec) * restingKcalPerSec + loadKcal);
}
