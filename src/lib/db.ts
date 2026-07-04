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

export async function loadDB(): Promise<DB> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as Partial<DB>;
    const base = emptyDB();
    return {
      ...base,
      ...parsed,
      // Merge settings so fields added later get defaults.
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyDB();
  }
}

export async function saveDB(db: DB): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}
