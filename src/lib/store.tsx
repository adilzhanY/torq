/**
 * The Torq store: loads the AsyncStorage DB, exposes domain actions, persists
 * on every commit, and runs delta sync when signed in (on login, on commit,
 * and on an interval — same shape as grit mobile).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { emptyDB, loadDB, saveDB, type DB, type SyncedTable } from "./db";
import { seedExercises } from "./seed";
import { sync } from "./sync";
import { useAuth } from "./auth";
import {
  uid,
  type Exercise,
  type Measurement,
  type Routine,
  type Settings,
  type Workout,
  type WorkoutEntry,
} from "../types";

const SYNC_EVERY_MS = 30_000;

interface StoreValue {
  ready: boolean;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  measurements: Measurement[];
  settings: Settings;
  activeWorkout: Workout | null;

  addExercise: (e: Omit<Exercise, "id" | "updatedAt">) => void;
  deleteExercise: (id: string) => void;

  saveRoutine: (name: string, entries: WorkoutEntry[], id?: string) => void;
  deleteRoutine: (id: string) => void;

  startWorkout: (routine?: Routine) => void;
  updateActiveWorkout: (patch: Partial<Workout>) => void;
  finishWorkout: () => void;
  discardWorkout: () => void;
  deleteWorkout: (id: string) => void;

  addMeasurement: (kind: string, value: number, unit: string) => void;
  deleteMeasurement: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const dbRef = useRef<DB>(emptyDB());
  const [ready, setReady] = useState(false);
  // Bumped on every commit so consumers re-render off the mutable DB ref.
  const [, setVersion] = useState(0);

  useEffect(() => {
    loadDB().then((db) => {
      if (db.exercises.length === 0 && db.workouts.length === 0) {
        db.exercises = seedExercises(Date.now());
      }
      dbRef.current = db;
      setReady(true);
      setVersion((v) => v + 1);
    });
  }, []);

  const commit = useCallback(() => {
    setVersion((v) => v + 1);
    void saveDB(dbRef.current);
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return;
    const res = await sync(dbRef.current, user.id).catch(() => null);
    if (res && (res.pulled > 0 || res.pushed > 0)) commit();
  }, [user, commit]);

  // Sync on login and on an interval while signed in.
  useEffect(() => {
    if (!user || !ready) return;
    void syncNow();
    const t = setInterval(() => void syncNow(), SYNC_EVERY_MS);
    return () => clearInterval(t);
  }, [user, ready, syncNow]);

  const stamp = <T extends { updatedAt: number }>(row: T): T => ({
    ...row,
    updatedAt: Date.now(),
  });

  const bury = (table: SyncedTable, id: string) => {
    dbRef.current.tombstones.push({ table, id, updatedAt: Date.now() });
  };

  const value: StoreValue = {
    ready,
    exercises: dbRef.current.exercises,
    routines: dbRef.current.routines,
    workouts: dbRef.current.workouts,
    measurements: dbRef.current.measurements,
    settings: dbRef.current.settings,
    activeWorkout: dbRef.current.activeWorkout,

    addExercise: (e) => {
      dbRef.current.exercises.push(stamp({ ...e, id: uid(), updatedAt: 0 }));
      commit();
    },
    deleteExercise: (id) => {
      dbRef.current.exercises = dbRef.current.exercises.filter((e) => e.id !== id);
      bury("exercises", id);
      commit();
    },

    saveRoutine: (name, entries, id) => {
      const routines = dbRef.current.routines;
      if (id) {
        const i = routines.findIndex((r) => r.id === id);
        if (i >= 0) routines[i] = stamp({ ...routines[i], name, entries });
      } else {
        routines.push(stamp({ id: uid(), name, entries, updatedAt: 0 }));
      }
      commit();
    },
    deleteRoutine: (id) => {
      dbRef.current.routines = dbRef.current.routines.filter((r) => r.id !== id);
      bury("routines", id);
      commit();
    },

    startWorkout: (routine) => {
      if (dbRef.current.activeWorkout) return;
      const entries: WorkoutEntry[] = (routine?.entries ?? []).map((e) => ({
        ...e,
        sets: e.sets.map((s) => ({ ...s, done: false })),
      }));
      dbRef.current.activeWorkout = stamp({
        id: uid(),
        name: routine?.name ?? "Workout",
        routineId: routine?.id,
        startedAt: Date.now(),
        entries,
        updatedAt: 0,
      });
      commit();
    },
    updateActiveWorkout: (patch) => {
      const w = dbRef.current.activeWorkout;
      if (!w) return;
      dbRef.current.activeWorkout = stamp({ ...w, ...patch });
      commit();
    },
    finishWorkout: () => {
      const w = dbRef.current.activeWorkout;
      if (!w) return;
      // Keep only sets that were actually done (drop empty planned rows).
      const entries = w.entries
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      dbRef.current.workouts.push(stamp({ ...w, entries, endedAt: Date.now() }));
      dbRef.current.activeWorkout = null;
      bury("active", w.id);
      commit();
    },
    discardWorkout: () => {
      const w = dbRef.current.activeWorkout;
      if (!w) return;
      dbRef.current.activeWorkout = null;
      bury("active", w.id);
      commit();
    },
    deleteWorkout: (id) => {
      dbRef.current.workouts = dbRef.current.workouts.filter((w) => w.id !== id);
      bury("workouts", id);
      commit();
    },

    addMeasurement: (kind, value, unit) => {
      dbRef.current.measurements.push(
        stamp({ id: uid(), kind, value, unit, at: Date.now(), updatedAt: 0 }),
      );
      commit();
    },
    deleteMeasurement: (id) => {
      dbRef.current.measurements = dbRef.current.measurements.filter((m) => m.id !== id);
      bury("measurements", id);
      commit();
    },

    updateSettings: (patch) => {
      dbRef.current.settings = stamp({ ...dbRef.current.settings, ...patch });
      commit();
    },
    syncNow,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}
