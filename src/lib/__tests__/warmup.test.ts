import { describe, expect, it } from "vitest";
import { BAR_WEIGHT, DEFAULT_WARMUP, formulaLabel, warmupSets, warmupWeight } from "../warmup";

describe("warmupWeight", () => {
  it("gives the bar its fixed weight, whatever the work set is", () => {
    expect(warmupWeight({ bar: true, reps: 5 }, 115, "kg")).toBe(20);
    expect(warmupWeight({ bar: true, reps: 5 }, 300, "kg")).toBe(20);
    expect(warmupWeight({ bar: true, reps: 5 }, 115, "lb")).toBe(45);
  });

  it("matches Strong's numbers for a 115 kg work set", () => {
    // The screenshot Adilzhan sent: 50% → 57.5, 80% → 92.5 (92 rounded up
    // to the 2.5 kg step).
    expect(warmupWeight({ pct: 50, reps: 3 }, 115, "kg")).toBe(57.5);
    expect(warmupWeight({ pct: 80, reps: 3 }, 115, "kg")).toBe(92.5);
  });

  it("rounds to the loadable step for the equipment", () => {
    // Dumbbells load in 1 kg, a barbell in 2.5.
    expect(warmupWeight({ pct: 50, reps: 3 }, 27, "kg", "dumbbell")).toBe(14);
    expect(warmupWeight({ pct: 50, reps: 3 }, 27, "kg", "barbell")).toBe(12.5);
  });

  it("never returns zero, a warm-up you cannot load is not a warm-up", () => {
    expect(warmupWeight({ pct: 5, reps: 5 }, 10, "kg")).toBe(2.5);
  });
});

describe("warmupSets", () => {
  it("builds the default ramp under a heavy work set", () => {
    const sets = warmupSets(DEFAULT_WARMUP, 115, "kg");
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([
      [20, 5],
      [57.5, 3],
      [92.5, 3],
    ]);
    expect(sets.every((s) => s.type === "warmup" && !s.done)).toBe(true);
  });

  it("drops rows that reach the work set", () => {
    // A 20 kg work set IS the bar, so the bar row is not a warm-up for it.
    const sets = warmupSets(DEFAULT_WARMUP, 20, "kg");
    expect(sets.map((s) => s.weight)).toEqual([10, 15]);
  });

  it("keeps every row when no work weight is known yet", () => {
    expect(warmupSets(DEFAULT_WARMUP, 0, "kg")).toHaveLength(3);
  });

  it("skips rows with no reps", () => {
    expect(warmupSets([{ pct: 50, reps: 0 }], 100, "kg")).toHaveLength(0);
  });
});

describe("formulaLabel", () => {
  it("reads the way the dialog shows it", () => {
    expect(formulaLabel({ bar: true, reps: 5 })).toBe("Bar × 5");
    expect(formulaLabel({ pct: 80, reps: 3 })).toBe("80% × 3");
  });
});

describe("BAR_WEIGHT", () => {
  it("is the standard olympic bar in both units", () => {
    expect(BAR_WEIGHT.kg).toBe(20);
    expect(BAR_WEIGHT.lb).toBe(45);
  });
});
