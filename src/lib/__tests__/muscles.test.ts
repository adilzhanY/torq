import { describe, expect, it } from "vitest";
import { recovering, routineMuscles, sessionTag } from "../muscles";
import type { BodyPart, Exercise, Routine, Workout, WorkoutSet } from "../../types";

const DAY = 86400000;
const NOW = new Date(2026, 7, 9, 12).getTime();

function ex(id: string, bodyPart: BodyPart): Exercise {
  return { id, name: id, bodyPart, equipment: "barbell", updatedAt: 0 };
}

function sets(n: number, opts: Partial<WorkoutSet> = {}): WorkoutSet[] {
  return Array.from({ length: n }, () => ({
    type: "normal",
    weight: 100,
    reps: 5,
    done: true,
    ...opts,
  }));
}

const LIB = [
  ex("bench", "chest"),
  ex("fly", "chest"),
  ex("ohp", "shoulders"),
  ex("dip", "arms"),
  ex("squat", "legs"),
];

function routine(entries: { exerciseId: string; sets: WorkoutSet[] }[]): Routine {
  return { id: "r", name: "Push Day", entries, updatedAt: 0 };
}

function workout(dayOffset: number, entries: { exerciseId: string; sets: WorkoutSet[] }[]): Workout {
  const at = NOW - dayOffset * DAY;
  return { id: `w${dayOffset}`, name: "W", startedAt: at, endedAt: at, entries, updatedAt: at };
}

describe("routineMuscles", () => {
  it("ranks by set count, not by exercise count", () => {
    const r = routine([
      { exerciseId: "ohp", sets: sets(5) },
      { exerciseId: "bench", sets: sets(2) },
      { exerciseId: "fly", sets: sets(2) },
    ]);
    // Chest has two exercises but four sets; shoulders has one with five.
    expect(routineMuscles(r, LIB)).toEqual(["shoulders", "chest"]);
  });

  it("caps the list so a chip row stays a headline", () => {
    const r = routine([
      { exerciseId: "bench", sets: sets(4) },
      { exerciseId: "ohp", sets: sets(3) },
      { exerciseId: "dip", sets: sets(2) },
      { exerciseId: "squat", sets: sets(1) },
    ]);
    expect(routineMuscles(r, LIB)).toHaveLength(3);
    expect(routineMuscles(r, LIB, 2)).toEqual(["chest", "shoulders"]);
  });

  it("ignores exercises missing from the library", () => {
    const r = routine([
      { exerciseId: "ghost", sets: sets(9) },
      { exerciseId: "bench", sets: sets(1) },
    ]);
    expect(routineMuscles(r, LIB)).toEqual(["chest"]);
  });
});

describe("recovering", () => {
  it("reports whole days since each group was last worked", () => {
    const ws = [
      workout(2, [{ exerciseId: "squat", sets: sets(3) }]),
      workout(4, [{ exerciseId: "bench", sets: sets(3) }]),
    ];
    expect(recovering(ws, LIB, NOW)).toEqual([
      { part: "legs", days: 2 },
      { part: "chest", days: 4 },
    ]);
  });

  it("does not count a group trained only with warmups", () => {
    const ws = [workout(1, [{ exerciseId: "bench", sets: sets(3, { type: "warmup" }) }])];
    expect(recovering(ws, LIB, NOW)).toEqual([]);
  });

  it("does not count sets that were never ticked off", () => {
    const ws = [workout(1, [{ exerciseId: "bench", sets: sets(3, { done: false }) }])];
    expect(recovering(ws, LIB, NOW)).toEqual([]);
  });

  it("ignores unfinished sessions", () => {
    const live: Workout = {
      id: "live",
      name: "Live",
      startedAt: NOW,
      entries: [{ exerciseId: "squat", sets: sets(2) }],
      updatedAt: NOW,
    };
    expect(recovering([live], LIB, NOW)).toEqual([]);
  });

  it("keeps the most recent date when a group appears twice", () => {
    const ws = [
      workout(6, [{ exerciseId: "bench", sets: sets(3) }]),
      workout(1, [{ exerciseId: "fly", sets: sets(3) }]),
    ];
    expect(recovering(ws, LIB, NOW)).toEqual([{ part: "chest", days: 1 }]);
  });
});

describe("sessionTag", () => {
  it("uses the routine's first word", () => {
    expect(sessionTag(routine([{ exerciseId: "bench", sets: sets(1) }]), LIB)).toBe("PUSH");
  });

  it("falls back to the body part when the name has no usable word", () => {
    const r: Routine = {
      id: "r",
      name: "A",
      entries: [{ exerciseId: "squat", sets: sets(3) }],
      updatedAt: 0,
    };
    expect(sessionTag(r, LIB)).toBe("LEGS");
  });

  it("truncates long names so the week strip stays aligned", () => {
    const r: Routine = {
      id: "r",
      name: "Posterior chain",
      entries: [{ exerciseId: "squat", sets: sets(1) }],
      updatedAt: 0,
    };
    expect(sessionTag(r, LIB)).toBe("POSTE");
  });
});
