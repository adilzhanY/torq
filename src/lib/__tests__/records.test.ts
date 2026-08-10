/**
 * The matcher decides whether an exercise gets a world-record line at all.
 * Being wrong in the permissive direction is the dangerous one: calling a
 * Smith-machine bench a "competition bench press" would put a nonsense
 * comparison in front of the user.
 */
import { describe, expect, it } from "vitest";
import { recordLiftOf, recordShare, worldRecord } from "../records";
import { RECORD_CLASSES } from "../../data/records";

describe("recordLiftOf", () => {
  it("matches the three plain barbell competition lifts", () => {
    expect(recordLiftOf("Barbell Bench Press", "barbell")).toBe("bench");
    expect(recordLiftOf("Barbell Full Squat", "barbell")).toBe("squat");
    expect(recordLiftOf("Barbell Deadlift", "barbell")).toBe("deadlift");
    expect(recordLiftOf("Barbell Sumo Deadlift", "barbell")).toBe("deadlift");
    expect(recordLiftOf("Barbell Low Bar Squat", "barbell")).toBe("squat");
  });

  it("refuses every variation that is a different lift", () => {
    const variations: [string, string][] = [
      ["Incline Bench Press", "barbell"],
      ["Decline Bench Press", "barbell"],
      ["Close Grip Bench Press", "barbell"],
      ["Barbell JM Bench Press", "barbell"],
      ["Smith Machine Bench Press", "barbell"],
      ["Front Squat", "barbell"],
      ["Barbell Hack Squat", "barbell"],
      ["Barbell Jefferson Squat", "barbell"],
      ["Barbell Squat Jerk", "barbell"],
      ["Overhead Squat", "barbell"],
      ["Romanian Deadlift", "barbell"],
      ["Stiff Leg Deadlift", "barbell"],
      ["Deficit Deadlift", "barbell"],
      ["Rack Pull Deadlift", "barbell"],
      ["Barbell One Arm Side Deadlift", "barbell"],
      ["Trap Bar Deadlift", "barbell"],
    ];
    for (const [name, eq] of variations) {
      expect(recordLiftOf(name, eq as never), name).toBeNull();
    }
  });

  it("requires a barbell, because the records are barbell records", () => {
    expect(recordLiftOf("Dumbbell Bench Press", "dumbbell")).toBeNull();
    expect(recordLiftOf("Machine Bench Press", "machine")).toBeNull();
    expect(recordLiftOf("Bodyweight Squat", "bodyweight")).toBeNull();
  });

  it("is case-insensitive, since catalog names are inconsistent", () => {
    expect(recordLiftOf("BARBELL DEADLIFT", "barbell")).toBe("deadlift");
    expect(recordLiftOf("barbell bench press", "barbell")).toBe("bench");
  });
});

describe("worldRecord", () => {
  it("picks the class containing the lifter's bodyweight", () => {
    expect(worldRecord("bench", "male", 82)!.className).toBe("83 kg");
    expect(worldRecord("bench", "male", 83)!.className).toBe("83 kg");
    expect(worldRecord("bench", "male", 83.1)!.className).toBe("93 kg");
  });

  it("puts anyone over the top class into the super-heavyweight bucket", () => {
    expect(worldRecord("squat", "male", 400)!.className).toBe("120+ kg");
    // Bench, not squat: the women's squat cells are deliberately uncurated.
    expect(worldRecord("bench", "female", 300)!.className).toBe("84+ kg");
  });

  it("returns null for cells that are not curated, instead of guessing", () => {
    // The women's squat classes are deliberately unfilled, see data/records.ts.
    expect(worldRecord("squat", "female", 60)).toBeNull();
    // ...but the ones we do have are present.
    expect(worldRecord("squat", "female", 84)).not.toBeNull();
  });

  it("names a holder for every curated record", () => {
    for (const sex of ["male", "female"] as const) {
      for (const row of RECORD_CLASSES[sex]) {
        for (const lift of ["squat", "bench", "deadlift"] as const) {
          const cell = row[lift];
          if (!cell) continue;
          expect(cell.kg, `${sex} ${row.label} ${lift}`).toBeGreaterThan(0);
          expect(cell.holder.length, `${sex} ${row.label} ${lift}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps every class ordered and non-overlapping", () => {
    for (const sex of ["male", "female"] as const) {
      const caps = RECORD_CLASSES[sex].map((r) => r.max);
      expect([...caps].sort((a, b) => a - b)).toEqual(caps);
      expect(caps[caps.length - 1]).toBe(Infinity);
    }
  });
});

describe("recordShare", () => {
  it("is the plain ratio, clamped at 1", () => {
    expect(recordShare(100, 200)).toBe(0.5);
    expect(recordShare(250, 200)).toBe(1);
    expect(recordShare(0, 200)).toBe(0);
    expect(recordShare(100, 0)).toBe(0);
  });
});
