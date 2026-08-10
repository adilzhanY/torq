/**
 * Percentiles are the one place the app makes a claim about OTHER people,
 * so the guards that keep it honest (monotonicity, tail clamping, only the
 * three competition lifts) are worth locking down.
 */
import { describe, expect, it } from "vitest";
import { percentileFor, percentileForExercise, percentileLabel } from "../percentile";
import { dotsPoints } from "../rank";

describe("percentileFor", () => {
  it("returns a sane percentile with the sample size behind it", () => {
    const p = percentileFor("bench", "male", dotsPoints(125, 83, "male"));
    expect(p).not.toBeNull();
    expect(p!.percent).toBeGreaterThan(35);
    expect(p!.percent).toBeLessThan(65);
    expect(p!.sampleSize).toBeGreaterThan(100_000);
  });

  it("never decreases as the lift gets heavier", () => {
    let prev = -1;
    for (let kg = 20; kg <= 320; kg += 5) {
      const p = percentileFor("squat", "male", dotsPoints(kg, 83, "male"));
      if (!p) continue;
      expect(p.percent).toBeGreaterThanOrEqual(prev);
      prev = p.percent;
    }
  });

  it("clamps both tails rather than claiming 0% or 100%", () => {
    const low = percentileFor("deadlift", "male", 1)!;
    expect(low.capped).toBe("low");
    expect(low.percent).toBeGreaterThan(0);

    const high = percentileFor("deadlift", "male", 999)!;
    expect(high.capped).toBe("high");
    expect(high.percent).toBeLessThan(100);
  });

  it("puts a world record at the very top of the curve", () => {
    // Men's 83 kg IPF classic bench record.
    const p = percentileFor("bench", "male", dotsPoints(218.5, 83, "male"))!;
    expect(p.percent).toBeGreaterThanOrEqual(99);
  });

  it("has no opinion about a zero or negative lift", () => {
    expect(percentileFor("bench", "male", 0)).toBeNull();
    expect(percentileFor("bench", "male", -10)).toBeNull();
  });

  it("scores the sexes off their own distributions", () => {
    const pts = dotsPoints(140, 63, "female");
    expect(percentileFor("deadlift", "female", pts)).not.toBeNull();
    expect(percentileFor("deadlift", "female", pts)!.sampleSize).toBeGreaterThan(10_000);
  });
});

describe("percentileForExercise", () => {
  it("only speaks for the three plain barbell competition lifts", () => {
    const pts = dotsPoints(120, 83, "male");
    expect(percentileForExercise("Barbell Bench Press", "barbell", "male", pts)).not.toBeNull();
    // Variations have no distribution of their own, better silent than wrong.
    expect(percentileForExercise("Incline Bench Press", "barbell", "male", pts)).toBeNull();
    expect(percentileForExercise("Dumbbell Bench Press", "dumbbell", "male", pts)).toBeNull();
    expect(percentileForExercise("Leg Extension", "machine", "male", pts)).toBeNull();
  });
});

describe("percentileLabel", () => {
  it("flips to 'Top N%' once the number stops being flattering as-is", () => {
    expect(percentileLabel({ percent: 40, sampleSize: 1, capped: null })).toBe("Stronger than 40%");
    expect(percentileLabel({ percent: 90, sampleSize: 1, capped: null })).toBe("Top 10%");
    expect(percentileLabel({ percent: 99, sampleSize: 1, capped: "high" })).toBe("Top 1%");
  });
});
