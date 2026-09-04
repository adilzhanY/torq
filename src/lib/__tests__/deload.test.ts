import { describe, expect, it } from "vitest";
import { DELOAD_FACTOR, deloadActive, deloadWeight, fatigueCheck } from "../deload";
import type { Exercise, Workout, WorkoutSet } from "../../types";

const DAY = 86400_000;
const NOW = 100 * DAY;

const ex = (id: string, name: string): Exercise =>
  ({ id, name, bodyPart: "chest", equipment: "barbell", updatedAt: 0 });

const set = (weight: number, reps: number): WorkoutSet =>
  ({ weight, reps, done: true, type: "normal" });

function session(id: string, daysAgo: number, lifts: Record<string, WorkoutSet[]>): Workout {
  const at = NOW - daysAgo * DAY;
  return {
    id,
    name: id,
    startedAt: at - 3600_000,
    endedAt: at,
    entries: Object.entries(lifts).map(([exerciseId, sets]) => ({ exerciseId, sets })),
    updatedAt: 0,
  };
}

const EXERCISES = [ex("bench", "Bench"), ex("squat", "Squat"), ex("row", "Row"), ex("ohp", "OHP")];

/** Three sessions of a lift stuck at the same weight, missing the target. */
function stuck(id: string, weight: number, reps: number) {
  return [
    session(`${id}-1`, 12, { [id]: [set(weight, reps), set(weight, reps)] }),
    session(`${id}-2`, 8, { [id]: [set(weight, reps), set(weight, reps)] }),
    session(`${id}-3`, 3, { [id]: [set(weight, reps), set(weight, reps)] }),
  ];
}

/** Three sessions of a lift that keeps hitting its target and climbing. */
function climbing(id: string, from: number) {
  return [
    session(`${id}-1`, 12, { [id]: [set(from, 8), set(from, 8)] }),
    session(`${id}-2`, 8, { [id]: [set(from + 2.5, 8), set(from + 2.5, 8)] }),
    session(`${id}-3`, 3, { [id]: [set(from + 5, 8), set(from + 5, 8)] }),
  ];
}

describe("fatigueCheck", () => {
  it("stays silent when everything is progressing", () => {
    const ws = [...climbing("bench", 80), ...climbing("squat", 100), ...climbing("row", 60)];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.stalled).toEqual([]);
    expect(r.recommend).toBe(false);
  });

  it("does not fire on a single stuck lift", () => {
    // One stalled lift is a normal week, and crying deload over it is how a
    // card gets ignored forever.
    const ws = [...stuck("bench", 100, 4), ...climbing("squat", 100), ...climbing("row", 60)];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.stalled).toEqual(["Bench"]);
    expect(r.tracked).toBe(3);
    expect(r.recommend).toBe(false);
  });

  it("fires when the majority of tracked lifts are stuck", () => {
    const ws = [...stuck("bench", 100, 4), ...stuck("squat", 140, 4), ...climbing("row", 60)];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.stalled).toHaveLength(2);
    expect(r.recommend).toBe(true);
  });

  it("needs at least three tracked lifts, so a two-lift week cannot trip it", () => {
    const ws = [...stuck("bench", 100, 4), ...stuck("squat", 140, 4)];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.tracked).toBe(2);
    expect(r.recommend).toBe(false);
  });

  it("ignores lifts you have stopped training", () => {
    // Stuck, but last trained two months ago: that is a changed programme,
    // not fatigue.
    const old = [
      session("o1", 70, { ohp: [set(50, 4), set(50, 4)] }),
      session("o2", 65, { ohp: [set(50, 4), set(50, 4)] }),
      session("o3", 60, { ohp: [set(50, 4), set(50, 4)] }),
    ];
    const ws = [...old, ...climbing("bench", 80), ...climbing("squat", 100), ...climbing("row", 60)];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.stalled).toEqual([]);
    expect(r.tracked).toBe(3);
  });

  it("ignores lifts without enough history to judge", () => {
    const ws = [
      session("n1", 2, { bench: [set(100, 4)] }),
      ...climbing("squat", 100),
      ...climbing("row", 60),
    ];
    expect(fatigueCheck(ws, EXERCISES, NOW).tracked).toBe(2);
  });

  it("lists the most recently trained stall first", () => {
    const ws = [
      ...stuck("bench", 100, 4),
      session("sq1", 13, { squat: [set(140, 4), set(140, 4)] }),
      session("sq2", 10, { squat: [set(140, 4), set(140, 4)] }),
      session("sq3", 1, { squat: [set(140, 4), set(140, 4)] }),
      ...climbing("row", 60),
    ];
    const r = fatigueCheck(ws, EXERCISES, NOW);
    expect(r.stalled[0]).toBe("Squat");
  });

  it("is quiet with no history at all", () => {
    expect(fatigueCheck([], EXERCISES, NOW)).toEqual({ stalled: [], tracked: 0, recommend: false });
  });
});

describe("deloadWeight", () => {
  it("eases off to roughly the deload factor, on a loadable step", () => {
    expect(deloadWeight(100, 2.5)).toBe(85);
    expect(DELOAD_FACTOR).toBe(0.85);
  });

  it("always comes down by at least one step", () => {
    // 20 * 0.85 = 17, which rounds to 17.5 on a 2.5 step: that is not lighter
    // enough to be a deload, so it must drop a full step instead.
    expect(deloadWeight(20, 2.5)).toBeLessThanOrEqual(17.5);
    expect(deloadWeight(5, 2.5)).toBe(2.5);
  });

  it("is never heavier than the weight it was given", () => {
    // 2 kg dumbbells on a 2.5 step used to come back as 2.5 kg: the outer
    // max(step, ...) snapped a sub-step weight UP during the deload week.
    for (const [w, step] of [[2, 2.5], [1, 2.5], [4, 2.5], [3, 5], [7.5, 5]] as const) {
      expect(deloadWeight(w, step)).toBeLessThanOrEqual(w);
    }
    expect(deloadWeight(2, 2.5)).toBe(2);
  });

  it("never goes below one step, and leaves bodyweight alone", () => {
    expect(deloadWeight(2.5, 2.5)).toBe(2.5);
    expect(deloadWeight(0, 2.5)).toBe(0);
  });
});

describe("deloadActive", () => {
  it("is only true while the week is still running", () => {
    expect(deloadActive(NOW + DAY, NOW)).toBe(true);
    expect(deloadActive(NOW - DAY, NOW)).toBe(false);
    expect(deloadActive(undefined, NOW)).toBe(false);
  });
});
