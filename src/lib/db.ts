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
    // Shape check, not just a parse: a blob where `workouts` is null or a
    // string parses fine and then crashes every consumer on first render,
    // and the next save would have written that shape back as the truth.
    const bad = validate(parsed);
    if (bad) throw new Error(bad);
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

/** Which table is malformed, or null when the blob has the right shape. */
function validate(parsed: Partial<DB>): string | null {
  if (typeof parsed !== "object" || parsed === null) return "Saved data is not an object.";
  const lists = ["exercises", "routines", "workouts", "measurements", "tombstones"] as const;
  for (const k of lists) {
    if (parsed[k] !== undefined && !Array.isArray(parsed[k])) return `Saved ${k} is not a list.`;
  }
  if (parsed.settings !== undefined && (typeof parsed.settings !== "object" || parsed.settings === null)) {
    return "Saved settings are not an object.";
  }
  if (parsed.activeWorkout !== undefined && parsed.activeWorkout !== null && typeof parsed.activeWorkout !== "object") {
    return "Saved active workout is malformed.";
  }
  return null;
}

/**
 * Set when the most recent save failed (quota, storage error). The store
 * shows it; the in-memory DB stays the truth and the next commit retries.
 * Before 2026-09-04 a failed save was an unhandled rejection: the user kept
 * logging into memory and lost the session on the next app kill.
 */
let saveFailure: string | null = null;
export function getSaveFailure(): string | null {
  return saveFailure;
}

// Writes are COALESCED: one in flight, at most one queued. Every commit used
// to fire its own JSON.stringify + setItem, so a fast typist could have a
// dozen overlapping writes of a growing blob, and `wipeLocal` could race one
// of them and be undone. Now a commit during a write just marks the next
// write needed, and wipe waits for the queue to drain.
let inflight: Promise<void> | null = null;
let queued: DB | null = null;

async function writeOnce(db: DB): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db));
    saveFailure = null;
  } catch (e) {
    saveFailure = e instanceof Error ? e.message : "Could not save.";
  }
}

export function saveDB(db: DB): Promise<void> {
  if (inflight) {
    queued = db;
    return inflight;
  }
  inflight = (async () => {
    let next: DB | null = db;
    while (next) {
      const cur = next;
      next = null;
      await writeOnce(cur);
      if (queued) {
        next = queued;
        queued = null;
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Resolves once no write is pending. */
export async function flushDB(): Promise<void> {
  while (inflight) await inflight;
}

/**
 * Erase everything torq stores on this device: the database, the corrupt
 * backup, and the sync cursors (leaving those behind would make a later
 * account skip rows it has never actually pulled).
 */
export async function wipeLocal(): Promise<void> {
  queued = null;
  await flushDB();
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter(
    (k) => k === KEY || k === BACKUP_KEY || k.startsWith("torq."),
  );
  await AsyncStorage.multiRemove(ours);
}
