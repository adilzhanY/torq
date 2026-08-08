/**
 * PR detection puts a trophy on a set. A false positive devalues every
 * badge, so the rules are strict: warmups can never set records, and ties
 * do not count.
 */
import { describe, expect, it } from "vitest";
import { computePRs, est1RM, repMax } from "../stats";
import type { Workout, WorkoutSet } from "../../types";

function session(sets: Partial<WorkoutSet>[], at: number, id = `w${at}`): Workout {
  return {
    id,
    name: "S",
    startedAt: at,
    endedAt: at + 1,
    updatedAt: at,
    entries: [
      {
        exerciseId: "bench",
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

describe("est1RM", () => {
  it("returns the weight itself for a single", () => {
    expect(est1RM(100, 1)).toBe(100);
  });

  it("adds an Epley bonus for higher reps", () => {
    expect(est1RM(100, 5)).toBe(117); // 100 * (1 + 5/30)
    expect(est1RM(100, 10)).toBe(133);
  });

  it("is zero for a non-lift", () => {
    expect(est1RM(0, 5)).toBe(0);
    expect(est1RM(100, 0)).toBe(0);
    expect(est1RM(-100, 5)).toBe(0);
  });

  it("round-trips with repMax at one rep", () => {
    expect(repMax(est1RM(140, 1), 1)).toBe(140);
  });

  it("predicts lighter weights for more reps", () => {
    const oneRm = 200;
    expect(repMax(oneRm, 5)).toBeLessThan(repMax(oneRm, 3));
    expect(repMax(oneRm, 10)).toBeLessThan(repMax(oneRm, 5));
  });
});

describe("computePRs", () => {
  it("marks a first-ever set as a record on all three counts", () => {
    const w = session([{ weight: 100, reps: 5 }], 10);
    const prs = computePRs(w, [w]);
    expect(prs.total).toBe(3); // weight, volume and 1RM all new
    expect(prs.bySet.get("0-0")).toEqual({ weight: true, vol: true, rm: true });
  });

  it("gives nothing to a session lighter than history", () => {
    const past = session([{ weight: 150, reps: 8 }], 1);
    const now = session([{ weight: 100, reps: 5 }], 10);
    expect(computePRs(now, [past, now]).total).toBe(0);
  });

  it("does not count a tie as a record", () => {
    const past = session([{ weight: 100, reps: 5 }], 1);
    const now = session([{ weight: 100, reps: 5 }], 10);
    expect(computePRs(now, [past, now]).total).toBe(0);
  });

  it("never lets a warmup set a record", () => {
    const past = session([{ weight: 100, reps: 5 }], 1);
    // A heavy set marked as a warmup must not earn a trophy.
    const now = session([{ weight: 300, reps: 5, type: "warmup" }], 10);
    expect(computePRs(now, [past, now]).total).toBe(0);
  });

  it("only badges the record-setting set, not every later one", () => {
    // Within one session: the second set beats the first, the third does not.
    const w = session(
      [{ weight: 100, reps: 5 }, { weight: 110, reps: 5 }, { weight: 90, reps: 5 }],
      10,
    );
    const prs = computePRs(w, [w]);
    expect(prs.bySet.has("0-1")).toBe(true);
    expect(prs.bySet.has("0-2")).toBe(false);
  });

  it("ignores workouts that happened after this one", () => {
    const future = session([{ weight: 500, reps: 5 }], 100);
    const now = session([{ weight: 100, reps: 5 }], 10);
    // A later session must not retroactively steal this one's record.
    expect(computePRs(now, [now, future]).total).toBeGreaterThan(0);
  });

  it("separates weight, volume and 1RM records", () => {
    const past = session([{ weight: 100, reps: 10 }], 1); // vol 1000, e1RM 133
    // Heavier but less volume: a weight PR without a volume PR.
    const now = session([{ weight: 120, reps: 5 }], 10); // vol 600, e1RM 140
    const prs = computePRs(now, [past, now]).bySet.get("0-0")!;
    expect(prs.weight).toBe(true);
    expect(prs.vol).toBe(false);
    expect(prs.rm).toBe(true);
  });

  it("ignores zero-weight sets", () => {
    const w = session([{ weight: 0, reps: 20 }], 10);
    expect(computePRs(w, [w]).total).toBe(0);
  });
});
