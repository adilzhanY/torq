import { describe, expect, it } from "vitest";
import { parseNum } from "../units";

describe("parseNum", () => {
  it("accepts a comma decimal", () => {
    expect(parseNum("1,5")).toBe(1.5);
    expect(parseNum("102.5")).toBe(102.5);
  });
  it("never returns a negative or NaN", () => {
    expect(parseNum("-5")).toBe(5);
    expect(parseNum("-")).toBe(0);
    expect(parseNum("")).toBe(0);
    expect(parseNum("abc")).toBe(0);
  });
  it("ignores stray characters and a trailing dot while typing", () => {
    expect(parseNum("5kg")).toBe(5);
    expect(parseNum("1.")).toBe(1);
    expect(parseNum("1,")).toBe(1);
  });
});

import { convertDB, convertWeight } from "../units";
import { emptyDB } from "../db";

describe("convertWeight", () => {
  it("round-trips 100 kg through lb", () => {
    expect(convertWeight(100, "kg", "lb")).toBe(220.46);
    expect(convertWeight(convertWeight(100, "kg", "lb"), "lb", "kg")).toBe(100);
  });
  it("is a no-op for the same unit", () => {
    expect(convertWeight(60, "kg", "kg")).toBe(60);
  });
});

describe("convertDB", () => {
  it("converts every stored weight and relabels weight measurements", () => {
    const db = {
      ...emptyDB(),
      workouts: [{ id: "w", name: "W", startedAt: 1, endedAt: 2, updatedAt: 1, entries: [{ exerciseId: "e", sets: [{ type: "normal" as const, weight: 100, reps: 5, done: true }] }] }],
      routines: [{ id: "r", name: "R", updatedAt: 1, entries: [{ exerciseId: "e", sets: [{ type: "normal" as const, weight: 60, reps: 5, done: false }] }] }],
      measurements: [
        { id: "m1", kind: "Body weight", value: 90, unit: "kg", at: 1, updatedAt: 1 },
        { id: "m2", kind: "Waist", value: 80, unit: "cm", at: 1, updatedAt: 1 },
      ],
      settings: { ...emptyDB().settings, unit: "kg" as const, weightKg: 90, plates: [20, 10] },
    };
    const out = convertDB(db, "kg", "lb");
    expect(out.workouts[0].entries[0].sets[0].weight).toBe(220.46);
    expect(out.routines[0].entries[0].sets[0].weight).toBe(132.28);
    expect(out.measurements[0]).toMatchObject({ value: 198.42, unit: "lb" });
    expect(out.measurements[1]).toMatchObject({ value: 80, unit: "cm" });
    expect(out.settings.unit).toBe("lb");
    expect(out.settings.weightKg).toBe(90);
    expect(out.settings.plates).toEqual([44.09, 22.05]);
    // New identities, so memoised consumers recompute.
    expect(out.workouts).not.toBe(db.workouts);
  });
});
