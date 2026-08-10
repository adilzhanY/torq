/**
 * Calorie estimation has been re-specified twice (v1 billed idle time, v2
 * capped at elapsed time and crushed backfilled sessions). The rule that
 * survived: activity only, the wall clock is ignored ENTIRELY, so a session
 * logged live and the same session backfilled must bill identically.
 */
import { describe, expect, it } from "vitest";
import { bodyProfileAt, workoutCalories } from "../calories";
import type { Exercise, Measurement, Settings, Workout } from "../../types";

const settings: Settings = { id: "settings", name: "", unit: "kg", restSec: 120, updatedAt: 0 };

const bench: Exercise = {
  id: "bench",
  name: "Barbell Bench Press",
  bodyPart: "chest",
  equipment: "barbell",
  updatedAt: 0,
};

const profile = { weightKg: 80, heightCm: 180, age: 30, sex: "male" as const, complete: true };

function workout(sets: { weight: number; reps: number; done?: boolean }[], span = 3600000): Workout {
  return {
    id: "w",
    name: "S",
    startedAt: 0,
    endedAt: span,
    updatedAt: 0,
    entries: [
      {
        exerciseId: "bench",
        sets: sets.map((s) => ({
          type: "normal" as const,
          weight: s.weight,
          reps: s.reps,
          done: s.done ?? true,
        })),
      },
    ],
  };
}

describe("workoutCalories", () => {
  it("bills nothing for a session with no completed sets", () => {
    expect(workoutCalories(workout([{ weight: 100, reps: 5, done: false }]), [bench], profile, settings)).toBe(0);
    expect(workoutCalories(workout([]), [bench], profile, settings)).toBe(0);
  });

  it("bills a single moderate set in single digits, not hundreds", () => {
    // The v1 bug billed idle session time and showed 186 kcal for one set.
    const kcal = workoutCalories(workout([{ weight: 70, reps: 5 }]), [bench], profile, settings);
    expect(kcal).toBeGreaterThan(0);
    expect(kcal).toBeLessThan(30);
  });

  it("IGNORES the wall clock, a backfilled session bills like a live one", () => {
    // This is the whole v2 fix: the same work entered a month later, in
    // seconds, must not be penalised.
    const sets = [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }];
    const live = workoutCalories(workout(sets, 45 * 60000), [bench], profile, settings);
    const backfilled = workoutCalories(workout(sets, 30000), [bench], profile, settings);
    expect(backfilled).toBe(live);
  });

  it("scales with the work done", () => {
    const one = workoutCalories(workout([{ weight: 100, reps: 5 }]), [bench], profile, settings);
    const ten = workoutCalories(
      workout(Array.from({ length: 10 }, () => ({ weight: 100, reps: 5 }))),
      [bench],
      profile,
      settings,
    );
    expect(ten).toBeGreaterThan(one * 5);
  });

  it("bills a heavier lifter more for identical work", () => {
    const w = workout([{ weight: 100, reps: 5 }]);
    const light = workoutCalories(w, [bench], { ...profile, weightKg: 55 }, settings);
    const heavy = workoutCalories(w, [bench], { ...profile, weightKg: 110 }, settings);
    expect(heavy).toBeGreaterThan(light);
  });

  it("lands a realistic full session in the low hundreds", () => {
    // 22 sets, ~7000 kg of volume. The session used to calibrate v2.
    const sets = Array.from({ length: 22 }, () => ({ weight: 80, reps: 4 }));
    const kcal = workoutCalories(workout(sets), [bench], profile, settings);
    expect(kcal).toBeGreaterThan(80);
    expect(kcal).toBeLessThan(500);
  });
});

describe("bodyProfileAt", () => {
  const measurement = (value: number, at: number): Measurement => ({
    id: `m${at}`,
    kind: "Body weight",
    value,
    unit: "kg",
    at,
    updatedAt: at,
  });

  it("falls back to defaults and says the profile is incomplete", () => {
    const p = bodyProfileAt(settings, [], 1000);
    expect(p.complete).toBe(false);
    expect(p.weightKg).toBeGreaterThan(0);
    expect(p.sex).toBe("male");
  });

  it("is complete once every field is set", () => {
    const full: Settings = { ...settings, sex: "female", birthYear: 1996, heightCm: 170, weightKg: 62 };
    const p = bodyProfileAt(full, [], new Date(2026, 0, 1).getTime());
    expect(p.complete).toBe(true);
    expect(p.sex).toBe("female");
    expect(p.age).toBe(30);
  });

  it("prefers a logged bodyweight over the settings fallback", () => {
    const full: Settings = { ...settings, weightKg: 80, sex: "male", birthYear: 1996, heightCm: 180 };
    const p = bodyProfileAt(full, [measurement(72, 500)], 1000);
    expect(p.weightKg).toBe(72);
  });

  it("uses the weight as of THAT date, so history reflects the past", () => {
    const full: Settings = { ...settings, weightKg: 80, sex: "male", birthYear: 1996, heightCm: 180 };
    const ms = [measurement(90, 1000), measurement(70, 5000)];
    // A workout at t=2000 should see 90 kg, not today's 70 kg.
    expect(bodyProfileAt(full, ms, 2000).weightKg).toBe(90);
    expect(bodyProfileAt(full, ms, 6000).weightKg).toBe(70);
  });

  it("keeps age inside a sane range", () => {
    const silly: Settings = { ...settings, birthYear: 1200 };
    expect(bodyProfileAt(silly, [], new Date(2026, 0, 1).getTime()).age).toBeLessThanOrEqual(100);
  });
});
