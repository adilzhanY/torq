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
import { DB_BY_ID, titleCase, toBodyPart, toEquipment } from "./exercisedb";
import { workoutName } from "./stats";
import type { RecommendedRoutine } from "./recommended";
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

  /** Returns the created row (the picker selects it right away). */
  addExercise: (e: Omit<Exercise, "id" | "updatedAt">) => Exercise;
  deleteExercise: (id: string) => void;

  saveRoutine: (name: string, entries: WorkoutEntry[], id?: string) => void;
  deleteRoutine: (id: string) => void;

  startWorkout: (routine?: Routine) => void;
  /** Start a recommended template: imports missing catalog exercises first. */
  startRecommended: (template: RecommendedRoutine) => void;
  updateActiveWorkout: (patch: Partial<Workout>) => void;
  /** Returns the finished workout (drives the post-workout summary). */
  finishWorkout: () => Workout | null;
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
      // One-time cleanup: drop the old seeded starter library (ids "seed-…").
      // The ExerciseDB catalog replaced it — "my exercises" holds only what
      // the user saved. Tombstoned so the delete also propagates via sync.
      const seeded = db.exercises.filter((e) => e.id.startsWith("seed-"));
      if (seeded.length) {
        db.exercises = db.exercises.filter((e) => !e.id.startsWith("seed-"));
        for (const e of seeded) {
          db.tombstones.push({ table: "exercises", id: e.id, updatedAt: Date.now() });
        }
        void saveDB(db);
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
      const row = stamp({ ...e, id: uid(), updatedAt: 0 });
      dbRef.current.exercises.push(row);
      commit();
      return row;
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
        name: routine?.name ?? workoutName(Date.now()),
        routineId: routine?.id || undefined,
        startedAt: Date.now(),
        entries,
        updatedAt: 0,
      });
      commit();
    },
    startRecommended: (template) => {
      if (dbRef.current.activeWorkout) return;
      const entries: WorkoutEntry[] = [];
      for (const item of template.items) {
        const dbEx = DB_BY_ID[item.dbId];
        if (!dbEx) continue;
        // Reuse the library exercise if it was imported before, else import.
        let ex = dbRef.current.exercises.find((e) => e.dbId === item.dbId);
        if (!ex) {
          ex = stamp({
            id: uid(),
            name: titleCase(dbEx.name),
            bodyPart: toBodyPart(dbEx.bodyParts[0] ?? "other"),
            equipment: toEquipment(dbEx.equipments[0] ?? "other"),
            dbId: item.dbId,
            updatedAt: 0,
          });
          dbRef.current.exercises.push(ex);
        }
        entries.push({
          exerciseId: ex.id,
          sets: Array.from({ length: item.sets }, () => ({
            type: "normal" as const,
            weight: 0,
            reps: item.reps,
            done: false,
          })),
        });
      }
      dbRef.current.activeWorkout = stamp({
        id: uid(),
        name: template.name,
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
      if (!w) return null;
      // Keep only sets that were actually done (drop empty planned rows).
      const entries = w.entries
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      const finished = stamp({ ...w, entries, endedAt: Date.now() });
      dbRef.current.workouts.push(finished);
      dbRef.current.activeWorkout = null;
      bury("active", w.id);
      commit();
      return finished;
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
