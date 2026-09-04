/**
 * Double progression: hit every rep at the top weight → go up; miss → repeat;
 * miss twice at the SAME weight → deload. These numbers land in the user's
 * bar, so being wrong is worse than being absent.
 */
import { describe, expect, it } from "vitest";
import { suggestWeight, targetRepsOf } from "../suggest";
import type { Workout, WorkoutSet } from "../../types";

function session(sets: Partial<WorkoutSet>[], at: number, exerciseId = "bench"): Workout {
  return {
    id: `w${at}`,
    name: "S",
    startedAt: at,
    endedAt: at + 1,
    updatedAt: at,
    entries: [
      {
        exerciseId,
        sets: sets.map((s) => ({
          type: s.type ?? "normal",
          weight: s.weight ?? 0,
          reps: s.reps ?? 0,
          done: true,
        })),
      },
    ],
  };
}

const three = (weight: number, reps: number) => [
  { weight, reps },
  { weight, reps },
  { weight, reps },
];

describe("suggestWeight", () => {
  it("has nothing to say without history", () => {
    expect(suggestWeight("bench", 5, [], "kg")).toBeNull();
  });

  it("goes up a step when every top set hit the target", () => {
    const s = suggestWeight("bench", 5, [session(three(100, 5), 1)], "kg");
    expect(s).toEqual({ kind: "increase", weight: 102.5 });
  });

  it("repeats after a single miss", () => {
    const s = suggestWeight("bench", 5, [session([{ weight: 100, reps: 5 }, { weight: 100, reps: 3 }], 1)], "kg");
    expect(s).toEqual({ kind: "repeat", weight: 100 });
  });

  it("deloads after two misses at the SAME top weight", () => {
    const miss = [{ weight: 100, reps: 5 }, { weight: 100, reps: 3 }];
    const s = suggestWeight("bench", 5, [session(miss, 1), session(miss, 2)], "kg");
    expect(s!.kind).toBe("deload");
    expect(s!.weight).toBeLessThan(100);
    expect(s!.weight).toBeGreaterThan(0);
  });

  it("does not deload when the two misses were at different weights", () => {
    const older = session([{ weight: 95, reps: 5 }, { weight: 95, reps: 3 }], 1);
    const newer = session([{ weight: 100, reps: 5 }, { weight: 100, reps: 3 }], 2);
    expect(suggestWeight("bench", 5, [older, newer], "kg")!.kind).toBe("repeat");
  });

  it("uses pound steps for pound users", () => {
    const s = suggestWeight("bench", 5, [session(three(200, 5), 1)], "lb");
    expect(s).toEqual({ kind: "increase", weight: 205 });
  });

  it("micro-loads dumbbells and cables instead of jumping 2.5 kg", () => {
    const db = suggestWeight("curl", 10, [session(three(20, 10), 1, "curl")], "kg", "dumbbell");
    expect(db).toEqual({ kind: "increase", weight: 21 });
    const barbell = suggestWeight("curl", 10, [session(three(20, 10), 1, "curl")], "kg", "barbell");
    expect(barbell).toEqual({ kind: "increase", weight: 22.5 });
  });

  it("never counts warmups as working sets", () => {
    // A heavy "warmup" must not become the top weight.
    const w = session(
      [{ weight: 200, reps: 5, type: "warmup" }, ...three(100, 5)],
      1,
    );
    expect(suggestWeight("bench", 5, [w], "kg")).toEqual({ kind: "increase", weight: 102.5 });
  });

  it("ignores bodyweight (zero-load) history", () => {
    expect(suggestWeight("pullup", 8, [session(three(0, 8), 1, "pullup")], "kg")).toBeNull();
  });

  it("ignores sessions that never finished", () => {
    const live = { ...session(three(100, 5), 1), endedAt: undefined };
    expect(suggestWeight("bench", 5, [live], "kg")).toBeNull();
  });

  it("reads history newest-first regardless of array order", () => {
    const older = session(three(90, 5), 1);
    const newer = session(three(100, 5), 5);
    const shuffled = suggestWeight("bench", 5, [newer, older], "kg");
    const ordered = suggestWeight("bench", 5, [older, newer], "kg");
    expect(shuffled).toEqual(ordered);
    expect(ordered!.weight).toBe(102.5);
  });

  it("refuses a nonsense target", () => {
    expect(suggestWeight("bench", 0, [session(three(100, 5), 1)], "kg")).toBeNull();
  });

  it("keeps a deload at or above one step", () => {
    // 90% of a very light weight must not round to zero.
    const miss = [{ weight: 2.5, reps: 5 }, { weight: 2.5, reps: 1 }];
    const s = suggestWeight("bench", 5, [session(miss, 1), session(miss, 2)], "kg");
    expect(s!.weight).toBeGreaterThanOrEqual(2.5);
  });
});

describe("suggestWeight edge cases (2026-09-04 audit)", () => {
  it("does not count a high-rep back-off set as hitting a low-rep target", () => {
    // 100 x 20 satisfies reps >= 5, but it is a different session, not a
    // pass on a 5-rep target. Repeat, don't increase.
    const ws = [session([{ weight: 100, reps: 20 }], 1)];
    expect(suggestWeight("bench", 5, ws, "kg")).toEqual({ kind: "repeat", weight: 100 });
  });

  it("treats two misses at floating-point-equal weights as the same weight", () => {
    // 102.50000000000001 comes out of a unit round trip; it is still 102.5.
    const ws = [session(three(102.5, 3), 2), session(three(102.50000000000001, 3), 1)];
    expect(suggestWeight("bench", 5, ws, "kg")?.kind).toBe("deload");
  });
});

describe("targetRepsOf", () => {
  it("takes the most common working rep count", () => {
    expect(targetRepsOf([
      { type: "normal", weight: 100, reps: 5, done: false },
      { type: "normal", weight: 100, reps: 5, done: false },
      { type: "normal", weight: 100, reps: 8, done: false },
    ])).toBe(5);
  });

  it("breaks a tie toward the higher target", () => {
    expect(targetRepsOf([
      { type: "normal", weight: 100, reps: 5, done: false },
      { type: "normal", weight: 100, reps: 8, done: false },
    ])).toBe(8);
  });

  it("skips warmups", () => {
    expect(targetRepsOf([
      { type: "warmup", weight: 40, reps: 12, done: false },
      { type: "normal", weight: 100, reps: 5, done: false },
    ])).toBe(5);
  });
});
