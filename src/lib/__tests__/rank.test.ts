/**
 * The rank engine is the product's whole claim ("how good am I?"), so its
 * maths gets the most assertions. Values here were cross-checked against
 * published DOTS calculators and the app's own record table.
 */
import { describe, expect, it } from "vitest";
import {
  closestTierUp,
  dotsPoints,
  kgForPoints,
  overallRank,
  rankLifts,
  stageOf,
  tierFor,
  tierLabel,
  TIER_NAMES,
} from "../rank";
import type { Workout } from "../../types";

function workout(sets: { weight: number; reps: number; type?: string }[], id = "w1"): Workout {
  return {
    id,
    name: "Session",
    startedAt: 1,
    endedAt: 2,
    updatedAt: 2,
    entries: [
      {
        exerciseId: "bench",
        sets: sets.map((s) => ({
          type: (s.type ?? "normal") as never,
          weight: s.weight,
          reps: s.reps,
          done: true,
        })),
      },
    ],
  };
}

describe("dotsPoints", () => {
  it("scores a lift and scales linearly with the weight", () => {
    const one = dotsPoints(100, 83, "male");
    expect(one).toBeGreaterThan(60);
    expect(one).toBeLessThan(80);
    expect(dotsPoints(200, 83, "male")).toBeCloseTo(one * 2, 6);
  });

  it("gives the lighter lifter more credit for the same weight", () => {
    expect(dotsPoints(100, 60, "male")).toBeGreaterThan(dotsPoints(100, 100, "male"));
  });

  it("scores women higher than men for the same weight and bodyweight", () => {
    // The whole point of a sex coefficient.
    expect(dotsPoints(100, 70, "female")).toBeGreaterThan(dotsPoints(100, 70, "male"));
  });

  it("is zero for a non-lift", () => {
    expect(dotsPoints(0, 80, "male")).toBe(0);
    expect(dotsPoints(-50, 80, "male")).toBe(0);
  });

  it("clamps bodyweight to the formula's valid range instead of going wild", () => {
    // Below 40 kg and above the cap the polynomial stops being meaningful.
    expect(dotsPoints(100, 10, "male")).toBe(dotsPoints(100, 40, "male"));
    expect(dotsPoints(100, 500, "male")).toBe(dotsPoints(100, 210, "male"));
    expect(dotsPoints(100, 500, "female")).toBe(dotsPoints(100, 150, "female"));
  });

  it("round-trips through kgForPoints", () => {
    const kg = 142.5;
    const pts = dotsPoints(kg, 78, "male");
    expect(kgForPoints(pts, 78, "male")).toBeCloseTo(kg, 6);
  });
});

describe("tierFor", () => {
  it("walks the whole ladder in order", () => {
    const tiers = [0, 30, 45, 60, 75, 95, 115, 140, 165].map((p) => tierFor(p, 1).tier);
    expect(tiers).toEqual([...TIER_NAMES]);
  });

  it("reports what is still missing to the next tier", () => {
    const s = tierFor(70, 1);
    expect(s.tier).toBe("Silver");
    expect(s.next).toBe("Gold");
    expect(s.toNext).toBe(5);
    expect(s.progress).toBeCloseTo((70 - 60) / (75 - 60), 6);
  });

  it("tops out cleanly with no next tier", () => {
    const s = tierFor(400, 1);
    expect(s.tier).toBe("World Class");
    expect(s.next).toBeNull();
    expect(s.toNext).toBe(0);
    expect(s.progress).toBe(1);
  });

  it("scales the thresholds for the overall (3-lift) ladder", () => {
    // 80 points is Gold for one lift but still Rust across three (Iron
    // needs 30x3 = 90).
    expect(tierFor(80, 1).tier).toBe("Gold");
    expect(tierFor(80, 3).tier).toBe("Rust");
    expect(tierFor(90, 3).tier).toBe("Iron");
    expect(tierFor(75 * 3, 3).tier).toBe("Gold");
  });

  it("never returns a progress outside 0..1", () => {
    for (let p = -50; p < 600; p += 7) {
      const s = tierFor(p, 1);
      expect(s.progress).toBeGreaterThanOrEqual(0);
      expect(s.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("stageOf / tierLabel", () => {
  it("splits a tier band into four stages", () => {
    expect(stageOf(0)).toBe(1);
    expect(stageOf(0.24)).toBe(1);
    expect(stageOf(0.25)).toBe(2);
    expect(stageOf(0.5)).toBe(3);
    expect(stageOf(0.75)).toBe(4);
    expect(stageOf(1)).toBe(4); // capped, never V
  });

  it("labels with a roman numeral", () => {
    expect(tierLabel(tierFor(60, 1))).toBe("Silver I");
    expect(tierLabel(tierFor(74, 1))).toBe("Silver IV");
  });
});

describe("rankLifts", () => {
  it("takes the best rank-eligible e1RM per exercise", () => {
    const lifts = rankLifts([workout([{ weight: 100, reps: 5 }, { weight: 110, reps: 3 }])], "kg", 80, "male");
    expect(lifts).toHaveLength(1);
    // 110x3 (=121) beats 100x5 (=117) on Epley.
    expect(lifts[0].e1RM).toBe(121);
  });

  it("ignores warmups, zero weights and sets over 10 reps", () => {
    const w = workout([
      { weight: 200, reps: 5, type: "warmup" }, // warmup: never counts
      { weight: 0, reps: 10 }, // bodyweight: no load to score
      { weight: 150, reps: 12 }, // Epley degrades past 10
      { weight: 100, reps: 5 }, // the only eligible set
    ]);
    const lifts = rankLifts([w], "kg", 80, "male");
    expect(lifts[0].e1RM).toBe(117);
  });

  it("ignores workouts that never finished", () => {
    const live = { ...workout([{ weight: 300, reps: 1 }]), endedAt: undefined };
    expect(rankLifts([live], "kg", 80, "male")).toEqual([]);
  });

  it("converts pounds before scoring, so the unit does not change the rank", () => {
    const inKg = rankLifts([workout([{ weight: 100, reps: 1 }])], "kg", 80, "male");
    const inLb = rankLifts([workout([{ weight: 220.462, reps: 1 }])], "lb", 80, "male");
    // Not exact: est1RM rounds in the DISPLAY unit, so a pound-logged lift
    // quantises slightly differently. Within a fifth of a point is fine.
    expect(Math.abs(inLb[0].points - inKg[0].points)).toBeLessThan(0.2);
  });

  it("sorts by points, strongest first", () => {
    const w: Workout = {
      ...workout([{ weight: 60, reps: 5 }]),
      entries: [
        { exerciseId: "a", sets: [{ type: "normal", weight: 60, reps: 5, done: true }] },
        { exerciseId: "b", sets: [{ type: "normal", weight: 180, reps: 5, done: true }] },
      ],
    };
    expect(rankLifts([w], "kg", 80, "male").map((l) => l.exerciseId)).toEqual(["b", "a"]);
  });
});

describe("overallRank", () => {
  it("sums only the top three lifts", () => {
    const entries = [10, 20, 30, 40].map((n, i) => ({
      exerciseId: `e${i}`,
      sets: [{ type: "normal" as const, weight: n * 3, reps: 1, done: true }],
    }));
    const w: Workout = { ...workout([]), entries };
    const lifts = rankLifts([w], "kg", 80, "male");
    const overall = overallRank(lifts);
    expect(overall.counted).toHaveLength(3);
    const expected = lifts.slice(0, 3).reduce((s, l) => s + l.points, 0);
    expect(overall.state.points).toBeCloseTo(expected, 6);
  });

  it("handles someone with no lifts at all", () => {
    const overall = overallRank([]);
    expect(overall.state.points).toBe(0);
    expect(overall.state.tier).toBe("Rust");
    expect(overall.counted).toEqual([]);
  });
});

describe("closestTierUp", () => {
  it("picks the lift needing the least extra weight", () => {
    const w: Workout = {
      ...workout([]),
      entries: [
        // Sitting just BELOW a threshold is what makes a tier-up close; being
        // just past one puts you at the START of a band, which is the
        // furthest point from the next.
        { exerciseId: "close", sets: [{ type: "normal", weight: 107, reps: 1, done: true }] },
        { exerciseId: "far", sets: [{ type: "normal", weight: 88, reps: 1, done: true }] },
      ],
    };
    const lifts = rankLifts([w], "kg", 80, "male");
    const up = closestTierUp(lifts, 80, "male", "kg");
    expect(up?.exerciseId).toBe("close");
    expect(up?.toGo).toBeGreaterThan(0);
  });

  it("returns null when every lift is already at the top", () => {
    const w = workout([{ weight: 400, reps: 1 }]);
    expect(closestTierUp(rankLifts([w], "kg", 80, "male"), 80, "male", "kg")).toBeNull();
  });
});
