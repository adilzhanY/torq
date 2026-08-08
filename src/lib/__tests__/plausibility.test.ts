/**
 * This gate decides what other people are allowed to see. It mostly catches
 * decimal-point typos rather than cheats, so "rejects the absurd, accepts
 * the merely very strong" is the property that matters.
 */
import { describe, expect, it } from "vitest";
import { checkLift, MAX_DOTS } from "../plausibility";
import { dotsPoints } from "../rank";
import { RECORD_CLASSES } from "../../data/records";

describe("checkLift", () => {
  it("accepts an ordinary lift", () => {
    expect(checkLift("Barbell Bench Press", "barbell", 100, 83, "male").ok).toBe(true);
  });

  it("accepts a world-record-equalling lift (the record itself is possible)", () => {
    // Men's 83 kg IPF classic bench.
    expect(checkLift("Barbell Bench Press", "barbell", 218.5, 83, "male").ok).toBe(true);
  });

  it("rejects a lift above the class world record, with a reason", () => {
    const res = checkLift("Barbell Bench Press", "barbell", 400, 83, "male");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/world record/i);
  });

  it("catches the classic missed decimal point", () => {
    const res = checkLift("Barbell Squat", "barbell", 1000, 80, "male");
    expect(res.ok).toBe(false);
  });

  it("falls back to a DOTS ceiling for movements with no official record", () => {
    // A curl has no world-record table, so only the DOTS ceiling applies.
    expect(checkLift("Dumbbell Curl", "dumbbell", 60, 80, "male").ok).toBe(true);
    const absurd = checkLift("Dumbbell Curl", "dumbbell", 900, 80, "male");
    expect(absurd.ok).toBe(false);
    expect(absurd.reason).toMatch(/human/i);
  });

  it("puts the DOTS ceiling above every real lift, at any bodyweight", () => {
    // Every bundled world record, scored at the LIGHTEST bodyweight that
    // still falls in its class (which maximises DOTS), must pass. This is
    // the assertion that caught MAX_DOTS being set at 200.
    for (const sex of ["male", "female"] as const) {
      const rows = RECORD_CLASSES[sex];
      rows.forEach((row, i) => {
        const lightest = i === 0 ? 40 : rows[i - 1].max + 0.1;
        for (const lift of ["squat", "bench", "deadlift"] as const) {
          const cell = row[lift];
          if (!cell) continue;
          expect(dotsPoints(cell.kg, lightest, sex), `${sex} ${row.label} ${lift}`).toBeLessThan(
            MAX_DOTS,
          );
        }
      });
    }
  });

  it("still catches a missed decimal point", () => {
    expect(dotsPoints(1000, 80, "male")).toBeGreaterThan(MAX_DOTS);
  });

  it("rejects a non-lift", () => {
    expect(checkLift("Barbell Squat", "barbell", 0, 80, "male").ok).toBe(false);
    expect(checkLift("Barbell Squat", "barbell", -5, 80, "male").ok).toBe(false);
  });

  it("uses the lifter's own weight class, not a fixed one", () => {
    // 200 kg is over the 59 kg class bench record but fine for a heavyweight.
    expect(checkLift("Barbell Bench Press", "barbell", 200, 59, "male").ok).toBe(false);
    expect(checkLift("Barbell Bench Press", "barbell", 200, 120, "male").ok).toBe(true);
  });

  it("does not apply a men's record to a woman", () => {
    // Comfortably over the women's 63 kg bench record, under the men's.
    expect(checkLift("Barbell Bench Press", "barbell", 180, 63, "female").ok).toBe(false);
  });
});
