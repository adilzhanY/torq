import { describe, expect, it } from "vitest";
import { monthRange, wrappedFor } from "../wrapped";
import type { Exercise, Workout, WorkoutSet } from "../../types";

const ex = (id: string, name: string): Exercise =>
  ({ id, name, bodyPart: "chest", equipment: "barbell", updatedAt: 0 });
const EXERCISES = [ex("bench", "Bench"), ex("squat", "Squat")];
const BODY = () => ({ weightKg: 85, sex: "male" as const });

const set = (weight: number, reps: number): WorkoutSet =>
  ({ weight, reps, done: true, type: "normal" });

function session(id: string, at: number, lifts: Record<string, WorkoutSet[]>): Workout {
  return {
    id,
    name: id,
    startedAt: at - 3600_000,
    endedAt: at,
    entries: Object.entries(lifts).map(([exerciseId, sets]) => ({ exerciseId, sets })),
    updatedAt: 0,
  };
}

const JULY = monthRange(Date.UTC(2026, 6, 15));
const jul = (day: number) => new Date(2026, 6, day, 12).getTime();
const jun = (day: number) => new Date(2026, 5, day, 12).getTime();

describe("monthRange", () => {
  it("covers the calendar month that contains the date", () => {
    const r = monthRange(new Date(2026, 6, 15).getTime());
    expect(new Date(r.from).getDate()).toBe(1);
    expect(new Date(r.from).getMonth()).toBe(6);
    expect(new Date(r.to).getMonth()).toBe(7);
    expect(r.label).toBe("July 2026");
  });
});

describe("wrappedFor", () => {
  it("counts only sessions inside the window", () => {
    const ws = [
      session("a", jun(20), { bench: [set(100, 5)] }),
      session("b", jul(2), { bench: [set(100, 5), set(100, 5)] }),
      session("c", jul(20), { bench: [set(105, 5)] }),
    ];
    const w = wrappedFor(ws, EXERCISES, "kg", BODY, JULY);
    expect(w.sessions).toBe(2);
    expect(w.sets).toBe(3);
    expect(w.label).toBe("July 2026");
  });

  it("measures a lift's move against where it stood BEFORE the month", () => {
    const ws = [
      session("a", jun(20), { bench: [set(100, 5)] }),
      session("b", jul(20), { bench: [set(110, 5)] }),
      session("c", jul(25), { bench: [set(112.5, 5)] }),
    ];
    const w = wrappedFor(ws, EXERCISES, "kg", BODY, JULY);
    const bench = w.moved.find((m) => m.name === "Bench");
    // Epley: weight * (1 + reps/30), so 100x5 is 117 and 112.5x5 is 131.
    expect(bench?.from).toBe(117);
    expect(bench?.to).toBe(131);
    expect(bench?.delta).toBe(14);
  });

  it("does not treat a lift's debut as a jump from zero", () => {
    // Squat appears for the first time this month. Claiming "+158 kg" would
    // be the card lying about a beginner.
    const ws = [
      session("a", jun(20), { bench: [set(100, 5)] }),
      session("b", jul(10), { bench: [set(105, 5)] }),
      session("c", jul(20), { squat: [set(140, 5)] }),
    ];
    const w = wrappedFor(ws, EXERCISES, "kg", BODY, JULY);
    expect(w.moved.map((m) => m.name)).toEqual(["Bench"]);
  });

  it("sorts the biggest jump first", () => {
    const ws = [
      session("a", jun(20), { bench: [set(100, 5)], squat: [set(140, 5)] }),
      session("b", jul(20), { bench: [set(102.5, 5)], squat: [set(155, 5)] }),
    ];
    const w = wrappedFor(ws, EXERCISES, "kg", BODY, JULY);
    expect(w.moved[0].name).toBe("Squat");
  });

  it("picks the session with the most records as the best one", () => {
    const ws = [
      session("a", jul(2), { bench: [set(100, 5)] }),
      session("b", jul(10), { bench: [set(120, 5), set(120, 5)] }),
      session("c", jul(20), { bench: [set(100, 5)] }),
    ];
    const w = wrappedFor(ws, EXERCISES, "kg", BODY, JULY);
    expect(w.best?.name).toBe("b");
    expect(w.records).toBeGreaterThan(0);
  });

  it("calls a single session too thin to wrap", () => {
    const ws = [session("a", jul(2), { bench: [set(100, 5)] })];
    expect(wrappedFor(ws, EXERCISES, "kg", BODY, JULY).empty).toBe(true);
  });

  it("is empty rather than broken with no history", () => {
    const w = wrappedFor([], EXERCISES, "kg", BODY, JULY);
    expect(w.empty).toBe(true);
    expect(w.sessions).toBe(0);
    expect(w.moved).toEqual([]);
    expect(w.best).toBeNull();
  });

  it("ignores unfinished sessions", () => {
    const live: Workout = {
      id: "live", name: "live", startedAt: jul(21), entries: [
        { exerciseId: "bench", sets: [set(100, 5)] }], updatedAt: 0,
    };
    const ws = [session("a", jul(2), { bench: [set(100, 5)] }),
                session("b", jul(9), { bench: [set(100, 5)] }), live];
    expect(wrappedFor(ws, EXERCISES, "kg", BODY, JULY).sessions).toBe(2);
  });
});
