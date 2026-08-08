/**
 * Persistence: the whole Torq dataset lives in one JSON blob in AsyncStorage
 * (same approach as grit mobile). Data volume is small (one user), so an
 * in-memory snapshot persisted on every write is simple and fast.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type Measurement,
  type Routine,
  type Settings,
  type Workout,
} from "../types";

/** A deleted row's gravestone so a delete propagates through sync. */
export interface Tombstone {
  table: string;
  id: string;
  updatedAt: number;
}

export interface DB {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  measurements: Measurement[];
  settings: Settings;
  /** The in-progress session, if any (singleton, synced). */
  activeWorkout: Workout | null;
  /** Delete gravestones, pushed to the server on sync. */
  tombstones: Tombstone[];
}

/** Synced collections, mapped to Supabase tables (see supabase/schema.sql). */
export const REMOTE_TABLE = {
  exercises: "exercises",
  routines: "routines",
  workouts: "workouts",
  measurements: "measurements",
  settings: "settings",
  active: "active",
} as const;

export type SyncedTable = keyof typeof REMOTE_TABLE;

const KEY = "torq.db.v1";

export function emptyDB(): DB {
  return {
    exercises: [],
    routines: [],
    workouts: [],
    measurements: [],
    settings: { ...DEFAULT_SETTINGS },
    activeWorkout: null,
    tombstones: [],
  };
}

/**
 * Set when a stored blob existed but could not be parsed. The app MUST NOT
 * treat that as "new user": returning an empty DB and carrying on would
 * overwrite the real (if damaged) data on the next save, turning a
 * recoverable glitch into permanent loss of someone's training history.
 */
let loadFailure: string | null = null;

/** Non-null when the last loadDB() hit a corrupt blob. */
export function getLoadFailure(): string | null {
  return loadFailure;
}

/** Key holding the last unparseable blob, kept for manual recovery. */
export const BACKUP_KEY = `${KEY}.corrupt`;

export async function loadDB(): Promise<DB> {
  loadFailure = null;
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(KEY);
  } catch (e) {
    loadFailure = e instanceof Error ? e.message : "Storage could not be read.";
    return emptyDB();
  }
  // A genuinely new install: nothing stored, nothing to lose.
  if (!raw) return emptyDB();

  try {
    const parsed = JSON.parse(raw) as Partial<DB>;
    const base = emptyDB();
    return {
      ...base,
      ...parsed,
      // Merge settings so fields added later get defaults.
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch (e) {
    // Keep the damaged blob: it is the only copy of this device's history,
    // and a human (or a later migration) may still salvage it.
    loadFailure = e instanceof Error ? e.message : "Saved data could not be read.";
    try {
      await AsyncStorage.setItem(BACKUP_KEY, raw);
    } catch {
      // Nothing more we can do; the flag still stops us pretending all is well.
    }
    return emptyDB();
  }
}

export async function saveDB(db: DB): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}
