/**
 * ExerciseDB catalog: the full open-source dataset (1500+ exercises) from
 * https://oss.exercisedb.dev/api/v1/exercises, snapshotted into
 * src/data/exercisedb.json for offline search.
 *
 * Refresh the snapshot by re-paginating the API (limit=100, follow
 * meta.nextCursor) into src/data/exercisedb.json.
 *
 * DEMO MEDIA IS OFF. See EXERCISE_MEDIA_ENABLED below; the catalog is data
 * only until licensed clips replace the old gifs.
 */
import type { BodyPart, Equipment } from "../types";
import RAW from "../data/exercisedb.json";

interface RawExercise {
  exerciseId: string;
  name: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
}

export interface DbExercise {
  /** ExerciseDB id. */
  id: string;
  name: string;
  /** Undefined while EXERCISE_MEDIA_ENABLED is false. Every consumer handles it. */
  gifUrl?: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
}

const raw = RAW as RawExercise[];

/**
 * THE MEDIA SEAM. Flip to true and demo clips come back everywhere at once.
 *
 * Turned OFF on 2026-08-16 for two reasons, and the second is the real one:
 *
 * 1. QUALITY. The gifs are 180x180 with 12 frames. The About tab drew them at
 *    `width: "100%"`, which on a 3x phone is 984 physical pixels, a 5.5x
 *    upscale that invents 97% of what you see. A demo you cannot read the grip
 *    from is not teaching anyone the movement.
 * 2. LICENCE. They came from ExerciseDB's open v1 endpoint, which publishes the
 *    DATA and never granted commercial rights to the MEDIA. The vendor has since
 *    rebranded to AscendAPI and moved its media behind paid plans and signed
 *    URLs. Mirroring someone else's artwork and shipping it in a paid Play app
 *    is a takedown risk, and Google removes first and asks later.
 *
 * The text is ours to use and is the part that actually instructs, so the About
 * tab leads with the how-to steps instead. When licensed clips are bought,
 * point MEDIA_BASE at them, flip this flag, and every screen picks them up:
 * nothing else reads a URL.
 */
export const EXERCISE_MEDIA_ENABLED = false;

/** Where demo clips live once EXERCISE_MEDIA_ENABLED is true. */
const MEDIA_BASE = "https://raw.githubusercontent.com/adilzhanY/exercise-db/main/media";

export const DB_EXERCISES: DbExercise[] = raw
  .map((e) => ({
    id: e.exerciseId,
    name: e.name,
    // Derived, not stored: the URL is a template around the id, and keeping
    // 1500 copies of it in the snapshot cost 89 KB of startup parsing.
    gifUrl: EXERCISE_MEDIA_ENABLED ? `${MEDIA_BASE}/${e.exerciseId}.gif` : undefined,
    bodyParts: e.bodyParts,
    equipments: e.equipments,
    targetMuscles: e.targetMuscles,
    secondaryMuscles: e.secondaryMuscles,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Demo clip URL by ExerciseDB id (for library rows imported from the catalog).
 * EMPTY while media is off, so every lookup returns undefined.
 */
export const DB_GIF_BY_ID: Record<string, string> = EXERCISE_MEDIA_ENABLED
  ? Object.fromEntries(DB_EXERCISES.map((e) => [e.id, e.gifUrl as string]))
  : {};

/** Catalog exercise by ExerciseDB id. */
export const DB_BY_ID: Record<string, DbExercise> = Object.fromEntries(
  DB_EXERCISES.map((e) => [e.id, e]),
);

/**
 * How-to steps for one exercise, loaded ON DEMAND.
 *
 * Instructions are 776 KB (69% of the original snapshot) and are read on
 * exactly one screen (the exercise About tab), so they are NOT part of the
 * startup blob. The inline require is the point: Metro evaluates the module
 * the first time this runs, not at app launch. Measured: splitting these
 * out took catalog load from ~274 ms to ~65 ms on every cold start.
 */
let instructionsById: Record<string, string[]> | null = null;

export function dbInstructions(id: string): string[] {
  if (!instructionsById) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      instructionsById = require("../data/exercisedb-instructions.json") as Record<
        string,
        string[]
      >;
    } catch {
      // Non-Metro runtimes (tests) have no require; instructions are not
      // load-bearing, so degrade to "no steps" rather than throwing.
      instructionsById = {};
    }
  }
  return instructionsById[id] ?? [];
}

/** Catalog names are lowercase; display them in title case. */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map an ExerciseDB body part to Torq's BodyPart. */
export function toBodyPart(dbBodyPart: string): BodyPart {
  switch (dbBodyPart) {
    case "chest": return "chest";
    case "back": return "back";
    case "upper legs":
    case "lower legs": return "legs";
    case "shoulders": return "shoulders";
    case "upper arms":
    case "lower arms": return "arms";
    case "waist": return "core";
    case "cardio": return "cardio";
    default: return "other";
  }
}

/** Map an ExerciseDB equipment to Torq's Equipment. */
export function toEquipment(dbEquipment: string): Equipment {
  switch (dbEquipment) {
    case "barbell":
    case "olympic barbell":
    case "ez barbell":
    case "trap bar": return "barbell";
    case "dumbbell": return "dumbbell";
    case "cable": return "cable";
    case "kettlebell": return "kettlebell";
    case "band":
    case "resistance band": return "band";
    case "body weight":
    case "assisted": return "bodyweight";
    case "leverage machine":
    case "sled machine":
    case "smith machine":
    case "stepmill machine":
    case "elliptical machine":
    case "stationary bike":
    case "skierg machine":
    case "upper body ergometer":
    case "wheel roller": return "machine";
    default: return "other";
  }
}
