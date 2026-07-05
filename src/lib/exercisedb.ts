/**
 * ExerciseDB catalog — the full open-source dataset (1500+ exercises) from
 * https://oss.exercisedb.dev/api/v1/exercises, snapshotted into
 * src/data/exercisedb.json for offline search. Gifs stay remote on the
 * ExerciseDB CDN (bundling ~1500 gifs would add hundreds of MB); expo-image
 * caches them on disk after first view.
 *
 * Refresh the snapshot by re-paginating the API (limit=100, follow
 * meta.nextCursor) into src/data/exercisedb.json.
 */
import type { BodyPart, Equipment } from "../types";

interface RawExercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

export interface DbExercise {
  /** ExerciseDB id. */
  id: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

const raw = require("../data/exercisedb.json") as RawExercise[];

/**
 * The dataset's gifUrl points at static.exercisedb.dev, a domain with no DNS
 * record (dead). The gifs are served from Adilzhan's mirror of the ExerciseDB
 * repo instead — github.com/adilzhanY/exercise-db holds all 1500 under
 * media/<exerciseId>.gif, delivered via GitHub's raw CDN.
 */
const GIF_BASE = "https://raw.githubusercontent.com/adilzhanY/exercise-db/main/media";

export const DB_EXERCISES: DbExercise[] = raw
  .map((e) => ({
    id: e.exerciseId,
    name: e.name,
    gifUrl: `${GIF_BASE}/${e.exerciseId}.gif`,
    bodyParts: e.bodyParts,
    equipments: e.equipments,
    targetMuscles: e.targetMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: e.instructions,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Gif URL by ExerciseDB id (for library rows imported from the catalog). */
export const DB_GIF_BY_ID: Record<string, string> = Object.fromEntries(
  DB_EXERCISES.map((e) => [e.id, e.gifUrl]),
);

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
