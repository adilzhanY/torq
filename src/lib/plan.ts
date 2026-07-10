/**
 * Training-plan generator — deterministic templates, no magic. Onboarding
 * answers (goal, days/week, focus) pick a split, a rep scheme, and exercise
 * slots from the bundled ExerciseDB catalog:
 *
 *   days 2 → Full Body A/B          days 5 → PPL + Upper/Lower
 *   days 3 → Push/Pull/Legs         days 6 → PPL ×2 (A/B variants)
 *   days 4 → Upper/Lower ×2 (A/B)
 *
 * Goal sets the scheme (sets × reps, rest): muscle 4×8/3×12, lean 3×12/3×15
 * short rests, fit 3×10/3×12. Strength runs mains-first like real strength
 * programs (531/GZCLP shape): the first two compounds of a day get the heavy
 * 5×5 with long rests, later compounds and isolations drop to moderate 3×8 —
 * otherwise a 4-compound day at 5×5×3min rest is a 2-hour session. Focused
 * muscle groups get +1 set on matching slots and unlock that day's extra
 * accessory slot (capped at MAX_SLOTS). Finally each day is trimmed from the
 * tail until it fits SESSION_CAP_MIN — a plan that doesn't fit a session is
 * a plan that gets abandoned.
 *
 * Exercises are referenced by ExerciseDB id (names in the snapshot aren't
 * stable enough to match on — one leg-press row has a mojibake "45в°").
 * Every dbId below is verified against src/data/exercisedb.json; unknown
 * ids are skipped at build time rather than crashing.
 */
import { DB_BY_ID } from "./exercisedb";
import type { BodyPart, PlanGoal, PlanPrefs } from "../types";

type Kind = "compound" | "isolation";

interface Slot {
  dbId: string;
  bodyPart: BodyPart; // Torq group, drives the focus bias
  kind: Kind;
}

const S = (dbId: string, bodyPart: BodyPart, kind: Kind): Slot => ({ dbId, bodyPart, kind });

// Verified catalog exercises (dbId → name, for the reviewer):
const BENCH = S("EIeI8Vf", "chest", "compound"); //           barbell bench press
const INCLINE = S("3TZduzM", "chest", "compound"); //         barbell incline bench press
const DB_BENCH = S("SpYC0Kp", "chest", "compound"); //        dumbbell bench press
const FLY = S("yz9nUhF", "chest", "isolation"); //            dumbbell fly
const OHP = S("znQUdHY", "shoulders", "compound"); //         dumbbell seated shoulder press
const LATERAL = S("DsgkuIt", "shoulders", "isolation"); //    dumbbell lateral raise
const REVERSE_FLY = S("EAs3xL9", "shoulders", "isolation"); //dumbbell reverse fly
const PUSHDOWN = S("3ZflifB", "arms", "isolation"); //        cable pushdown
const OH_TRICEPS = S("2IxROQ1", "arms", "isolation"); //      cable overhead triceps extension
const CURL = S("25GPyDY", "arms", "isolation"); //            barbell curl
const HAMMER = S("slDvUAU", "arms", "isolation"); //          dumbbell hammer curl
const DEADLIFT = S("ila4NZS", "back", "compound"); //         barbell deadlift
const PULLUP = S("lBDjFxJ", "back", "compound"); //           pull-up
const PULLDOWN = S("RVwzP10", "back", "compound"); //         cable pulldown
const ROW = S("fUBheHs", "back", "compound"); //              cable seated row
const BB_ROW = S("eZyBC3j", "back", "compound"); //           barbell bent over row
const SHRUG = S("NJzBsGJ", "back", "isolation"); //           dumbbell shrug
const SQUAT = S("qXTaZnJ", "legs", "compound"); //            barbell full squat
const RDL = S("wQ2c4XD", "legs", "compound"); //              barbell romanian deadlift
const DB_RDL = S("rR0LJzx", "legs", "compound"); //           dumbbell romanian deadlift
const LEG_PRESS = S("10Z2DXU", "legs", "compound"); //        sled 45° leg press
const GOBLET = S("yn8yg1r", "legs", "compound"); //           dumbbell goblet squat
const LUNGE = S("RRWFUcw", "legs", "compound"); //            dumbbell lunge
const LEG_EXT = S("my33uHU", "legs", "isolation"); //         lever leg extension
const LEG_CURL = S("17lJ1kr", "legs", "isolation"); //        lever lying leg curl
const CALF = S("8ozhUIZ", "legs", "isolation"); //            barbell standing calf raise
const CALF_SEATED = S("bOOdeyc", "legs", "isolation"); //     lever seated calf raise
const CRUNCH = S("TFqbd8t", "core", "isolation"); //          crunch floor
const X_CRUNCH = S("rbu5UUb", "core", "isolation"); //        cross body crunch
const LEG_RAISE = S("I3tsCnC", "core", "isolation"); //       hanging leg raise

interface DayTemplate {
  name: string;
  blurb: string;
  slots: Slot[];
  /** Optional accessory unlocked when its body part is a focus pick. */
  extras: Partial<Record<BodyPart, Slot>>;
}

const PUSH: DayTemplate = {
  name: "Push Day",
  blurb: "Chest, shoulders & triceps",
  slots: [BENCH, INCLINE, OHP, LATERAL, PUSHDOWN],
  extras: { chest: FLY, shoulders: REVERSE_FLY, arms: OH_TRICEPS },
};
const PUSH_B: DayTemplate = {
  name: "Push Day B",
  blurb: "Chest, shoulders & triceps — dumbbell variant",
  slots: [DB_BENCH, INCLINE, OHP, FLY, OH_TRICEPS],
  extras: { shoulders: REVERSE_FLY, arms: PUSHDOWN },
};
const PULL: DayTemplate = {
  name: "Pull Day",
  blurb: "Back & biceps",
  slots: [DEADLIFT, PULLUP, PULLDOWN, ROW, CURL],
  extras: { back: BB_ROW, arms: HAMMER },
};
const PULL_B: DayTemplate = {
  name: "Pull Day B",
  blurb: "Back, rear delts & biceps",
  slots: [BB_ROW, PULLDOWN, ROW, REVERSE_FLY, HAMMER],
  extras: { back: SHRUG, arms: CURL },
};
const LEGS: DayTemplate = {
  name: "Leg Day",
  blurb: "Quads, hamstrings & calves",
  slots: [SQUAT, RDL, LEG_EXT, LEG_CURL, CALF],
  extras: { legs: LUNGE, core: LEG_RAISE },
};
const LEGS_B: DayTemplate = {
  name: "Leg Day B",
  blurb: "Quads, glutes & calves — machine variant",
  slots: [LEG_PRESS, GOBLET, DB_RDL, LEG_EXT, CALF_SEATED],
  extras: { legs: LUNGE, core: CRUNCH },
};
const UPPER_A: DayTemplate = {
  name: "Upper Day A",
  blurb: "Chest, back, shoulders & arms",
  slots: [BENCH, BB_ROW, OHP, PULLDOWN, LATERAL, CURL],
  extras: { chest: FLY, arms: PUSHDOWN, shoulders: REVERSE_FLY, back: SHRUG },
};
const UPPER_B: DayTemplate = {
  name: "Upper Day B",
  blurb: "Chest, back, shoulders & arms — variant",
  slots: [INCLINE, ROW, PULLUP, DB_BENCH, REVERSE_FLY, PUSHDOWN],
  extras: { arms: HAMMER, shoulders: LATERAL, chest: FLY },
};
const LOWER_A: DayTemplate = {
  name: "Lower Day A",
  blurb: "Quads, hamstrings, calves & core",
  slots: [SQUAT, RDL, LEG_PRESS, LEG_CURL, CALF, CRUNCH],
  extras: { legs: LEG_EXT, core: LEG_RAISE },
};
const LOWER_B: DayTemplate = {
  name: "Lower Day B",
  blurb: "Quads, glutes, calves & core — variant",
  slots: [LEG_PRESS, GOBLET, DB_RDL, LEG_EXT, CALF_SEATED, X_CRUNCH],
  extras: { legs: LUNGE, core: LEG_RAISE },
};
const FULL_A: DayTemplate = {
  name: "Full Body A",
  blurb: "Squat + push + pull, whole body",
  slots: [SQUAT, BENCH, ROW, LATERAL, CRUNCH],
  extras: { arms: CURL, legs: LEG_CURL, chest: FLY, shoulders: REVERSE_FLY, back: PULLDOWN, core: LEG_RAISE },
};
const FULL_B: DayTemplate = {
  name: "Full Body B",
  blurb: "Hinge + press + pull, whole body",
  slots: [DEADLIFT, DB_BENCH, PULLDOWN, GOBLET, LEG_RAISE],
  extras: { arms: PUSHDOWN, legs: LEG_EXT, chest: INCLINE, shoulders: LATERAL, back: ROW, core: X_CRUNCH },
};

/** Template sequence per training frequency; the user's chosen weekdays
 *  (Monday-first) receive the templates in this order. */
const SPLITS: Record<number, DayTemplate[]> = {
  2: [FULL_A, FULL_B],
  3: [PUSH, PULL, LEGS],
  4: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  5: [PUSH, PULL, LEGS, UPPER_A, LOWER_A],
  6: [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B],
};

/** Fallback layouts if prefs somehow carry fewer weekdays than templates. */
const DEFAULT_DAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

/** Unique weekdays sorted Monday-first (Mon 1 … Sat 6, Sun 0 last). */
export function mondayFirst(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

interface Scheme {
  sets: number;
  reps: number;
  restSec: number;
}

/** Sets × reps × rest per goal and movement kind. */
const SCHEMES: Record<PlanGoal, Record<Kind, Scheme>> = {
  muscle: {
    compound: { sets: 4, reps: 8, restSec: 120 },
    isolation: { sets: 3, reps: 12, restSec: 90 },
  },
  lean: {
    compound: { sets: 3, reps: 12, restSec: 60 },
    isolation: { sets: 3, reps: 15, restSec: 45 },
  },
  strength: {
    // Applies to the first HEAVY_COMPOUNDS lifts of a day only.
    compound: { sets: 5, reps: 5, restSec: 180 },
    isolation: { sets: 3, reps: 8, restSec: 90 },
  },
  fit: {
    compound: { sets: 3, reps: 10, restSec: 90 },
    isolation: { sets: 3, reps: 12, restSec: 60 },
  },
};

/** Strength: how many lifts per day run the heavy scheme… */
const HEAVY_COMPOUNDS = 2;
/** …later compounds drop to a moderate accessory scheme. */
const STRENGTH_ACCESSORY: Scheme = { sets: 3, reps: 8, restSec: 120 };

function schemeFor(goal: PlanGoal, kind: Kind, compoundIndex: number): Scheme {
  if (goal === "strength" && kind === "compound" && compoundIndex >= HEAVY_COMPOUNDS) {
    return STRENGTH_ACCESSORY;
  }
  return SCHEMES[goal][kind];
}

export const GOAL_META: Record<
  PlanGoal,
  { label: string; blurb: string; kcalGoal: number }
> = {
  muscle: { label: "Build muscle", blurb: "Hypertrophy — moderate reps, solid rest", kcalGoal: 300 },
  lean: { label: "Get lean", blurb: "Higher reps, short rests, more burn", kcalGoal: 400 },
  strength: { label: "Get strong", blurb: "Heavy compounds, low reps, long rest", kcalGoal: 250 },
  fit: { label: "Stay fit", blurb: "Balanced, sustainable all-round training", kcalGoal: 300 },
};

const MAX_SLOTS = 8;
const MAX_SETS = 5;
/** Hard ceiling on the estimated session length. */
const SESSION_CAP_MIN = 90;
const MIN_SLOTS = 5;

export interface PlanDayItem {
  dbId: string;
  bodyPart: BodyPart;
  sets: number;
  reps: number;
  restSec: number;
}

export interface PlanDay {
  name: string;
  blurb: string;
  weekday: number;
  items: PlanDayItem[];
}

/** Clamp days/week into the splits we define. */
export function clampDays(n: number): number {
  return Math.max(2, Math.min(6, Math.round(n)));
}

/**
 * Build the full plan. Deterministic: same prefs → same plan. Focused body
 * parts get +1 set on matching slots and unlock the day's extra accessory.
 */
export function buildPlan(prefs: PlanPrefs): PlanDay[] {
  const focus = new Set(prefs.focus);
  const chosen = mondayFirst(prefs.weekdays);
  const n = clampDays(chosen.length);

  return SPLITS[n].map((template, i) => {
    const weekday = chosen[i] ?? DEFAULT_DAYS[n][i];
    const slots = [...template.slots];
    for (const part of prefs.focus) {
      const extra = template.extras[part];
      if (extra && slots.length < MAX_SLOTS && !slots.some((s) => s.dbId === extra.dbId)) {
        slots.push(extra);
      }
    }
    let compoundIndex = 0;
    const items = slots
      .filter((s) => !!DB_BY_ID[s.dbId]) // never reference a missing catalog row
      .map((s) => {
        const base = schemeFor(prefs.goal, s.kind, s.kind === "compound" ? compoundIndex++ : 0);
        return {
          dbId: s.dbId,
          bodyPart: s.bodyPart,
          sets: Math.min(MAX_SETS, base.sets + (focus.has(s.bodyPart) ? 1 : 0)),
          reps: base.reps,
          restSec: base.restSec,
        };
      });
    // Fit the session budget by dropping tail accessories (extras and
    // isolations sit at the end of every template).
    while (planDayMinutes(items) > SESSION_CAP_MIN && items.length > MIN_SLOTS) {
      items.pop();
    }
    return { name: template.name, blurb: template.blurb, weekday, items };
  });
}

/** Rough session length: per-set work (~15s + 4s/rep) plus its rest. */
export function planDayMinutes(items: PlanDayItem[]): number {
  const sec = items.reduce(
    (t, it) => t + it.sets * (15 + 4 * it.reps + it.restSec),
    0,
  );
  return Math.round(sec / 60);
}
