import { describe, expect, it } from "vitest";
import { liftMovement, rankHistory, recentRecords, tierDates } from "../progress";
import type { Workout, WorkoutSet } from "../../types";

const DAY = 86400000;
const T0 = new Date(2026, 0, 1).getTime();

function set(weight: number, reps: number, type: WorkoutSet["type"] = "normal"): WorkoutSet {
  return { type, weight, reps, done: true };
}

let seq = 0;
function workout(dayOffset: number, entries: { exerciseId: string; sets: WorkoutSet[] }[]): Workout {
  const at = T0 + dayOffset * DAY;
  return {
    id: `w${seq++}`,
    name: "W",
    startedAt: at,
    endedAt: at + 3600000,
    entries,
    updatedAt: at,
  };
}

const body = () => ({ weightKg: 90, sex: "male" as const });

describe("rankHistory", () => {
  it("is empty with no finished workouts", () => {
    expect(rankHistory([], "kg", body, T0, T0 + 30 * DAY)).toEqual([]);
  });

  it("rises as the lift improves and never falls at constant bodyweight", () => {
    const ws = [
      workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }]),
      workout(30, [{ exerciseId: "sq", sets: [set(120, 5)] }]),
      workout(60, [{ exerciseId: "sq", sets: [set(140, 5)] }]),
    ];
    const h = rankHistory(ws, "kg", body, T0, T0 + 90 * DAY, 10);
    expect(h).toHaveLength(10);
    for (let i = 1; i < h.length; i++) {
      expect(h[i].points).toBeGreaterThanOrEqual(h[i - 1].points - 1e-9);
    }
    expect(h[h.length - 1].points).toBeGreaterThan(h[0].points);
  });

  it("counts only the top 3 lifts, like overallRank", () => {
    const four = ["a", "b", "c", "d"].map((id) =>
      workout(0, [{ exerciseId: id, sets: [set(100, 5)] }]),
    );
    const three = ["a", "b", "c"].map((id) =>
      workout(0, [{ exerciseId: id, sets: [set(100, 5)] }]),
    );
    const h4 = rankHistory(four, "kg", body, T0, T0 + 10 * DAY, 3);
    const h3 = rankHistory(three, "kg", body, T0, T0 + 10 * DAY, 3);
    expect(h4[2].points).toBeCloseTo(h3[2].points, 6);
  });

  it("falls when bodyweight rises and the lift does not (DOTS is normalized)", () => {
    const ws = [workout(0, [{ exerciseId: "sq", sets: [set(140, 3)] }])];
    const growing = (ms: number) => ({
      weightKg: 80 + ((ms - T0) / DAY) * 0.5,
      sex: "male" as const,
    });
    // Sample from AFTER the session finished, so both ends already count the
    // lift and the only thing changing between them is bodyweight.
    const h = rankHistory(ws, "kg", growing, T0 + DAY, T0 + 60 * DAY, 5);
    expect(h[0].points).toBeGreaterThan(0);
    expect(h[h.length - 1].points).toBeLessThan(h[0].points);
  });

  it("ignores warmups and sets past 10 reps, matching rankLifts", () => {
    const clean = [workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }])];
    // A heavy WARMUP and a heavy 15-rep set must both be invisible to the
    // rank, or a 300 kg warmup single would fake a World Class squat.
    const noisy = [
      workout(0, [
        { exerciseId: "sq", sets: [set(100, 5), set(300, 5, "warmup"), set(200, 15)] },
      ]),
    ];
    const a = rankHistory(clean, "kg", body, T0, T0 + 10 * DAY, 3);
    const b = rankHistory(noisy, "kg", body, T0, T0 + 10 * DAY, 3);
    expect(b[2].points).toBeCloseTo(a[2].points, 6);
  });

  it("is flat before the first workout lands", () => {
    const ws = [workout(20, [{ exerciseId: "sq", sets: [set(100, 5)] }])];
    const h = rankHistory(ws, "kg", body, T0, T0 + 40 * DAY, 5);
    expect(h[0].points).toBe(0);
    expect(h[h.length - 1].points).toBeGreaterThan(0);
  });

  it("converts pounds before scoring", () => {
    const ws = [workout(0, [{ exerciseId: "sq", sets: [set(200, 5)] }])];
    const kg = rankHistory(ws, "kg", body, T0, T0 + DAY, 2);
    const lb = rankHistory(ws, "lb", body, T0, T0 + DAY, 2);
    expect(lb[1].points).toBeLessThan(kg[1].points);
  });
});

describe("liftMovement", () => {
  it("reports the gain between the window's edges", () => {
    const ws = [
      workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }]),
      workout(40, [{ exerciseId: "sq", sets: [set(120, 5)] }]),
    ];
    const [row] = liftMovement(ws, T0 + 10 * DAY, T0 + 60 * DAY);
    expect(Math.round(row.from)).toBe(Math.round(100 * (1 + 5 / 30)));
    expect(Math.round(row.to)).toBe(Math.round(120 * (1 + 5 / 30)));
    expect(row.isNew).toBe(false);
  });

  it("shows a stall as from === to", () => {
    const ws = [
      workout(0, [{ exerciseId: "pd", sets: [set(80, 8)] }]),
      workout(40, [{ exerciseId: "pd", sets: [set(80, 8)] }]),
    ];
    const [row] = liftMovement(ws, T0 + 10 * DAY, T0 + 60 * DAY);
    expect(row.to).toBeCloseTo(row.from, 6);
  });

  it("starts a brand-new lift at its debut, not at zero", () => {
    const ws = [workout(20, [{ exerciseId: "dl", sets: [set(150, 3)] }])];
    const [row] = liftMovement(ws, T0 + 10 * DAY, T0 + 60 * DAY);
    expect(row.isNew).toBe(true);
    expect(row.from).toBeCloseTo(row.to, 6);
    expect(row.from).toBeGreaterThan(0);
  });

  it("ignores workouts after the window", () => {
    const ws = [
      workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }]),
      workout(90, [{ exerciseId: "sq", sets: [set(200, 5)] }]),
    ];
    const [row] = liftMovement(ws, T0, T0 + 60 * DAY);
    expect(row.to).toBeLessThan(150);
  });

  it("sorts by current strength, strongest first", () => {
    const ws = [
      workout(0, [
        { exerciseId: "light", sets: [set(60, 5)] },
        { exerciseId: "heavy", sets: [set(180, 5)] },
      ]),
    ];
    const rows = liftMovement(ws, T0 - DAY, T0 + DAY);
    expect(rows[0].exerciseId).toBe("heavy");
  });
});

describe("recentRecords", () => {
  it("does not call a lift's first appearance a record", () => {
    const ws = [workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }])];
    expect(recentRecords(ws)).toEqual([]);
  });

  it("records only improvements, newest first", () => {
    const ws = [
      workout(0, [{ exerciseId: "sq", sets: [set(100, 5)] }]),
      workout(10, [{ exerciseId: "sq", sets: [set(90, 5)] }]),
      workout(20, [{ exerciseId: "sq", sets: [set(110, 5)] }]),
      workout(30, [{ exerciseId: "sq", sets: [set(120, 5)] }]),
    ];
    const ev = recentRecords(ws);
    expect(ev).toHaveLength(2);
    expect(ev[0].at).toBeGreaterThan(ev[1].at);
    expect(ev[0].previous).toBeLessThan(ev[0].e1RM);
  });

  it("honours the limit", () => {
    const ws = [workout(0, [{ exerciseId: "sq", sets: [set(50, 5)] }])];
    for (let i = 1; i <= 12; i++) {
      ws.push(workout(i, [{ exerciseId: "sq", sets: [set(50 + i * 5, 5)] }]));
    }
    expect(recentRecords(ws, 5)).toHaveLength(5);
  });

  it("tracks each lift separately", () => {
    const ws = [
      workout(0, [
        { exerciseId: "a", sets: [set(100, 5)] },
        { exerciseId: "b", sets: [set(50, 5)] },
      ]),
      workout(10, [{ exerciseId: "b", sets: [set(60, 5)] }]),
    ];
    const ev = recentRecords(ws);
    expect(ev).toHaveLength(1);
    expect(ev[0].exerciseId).toBe("b");
  });
});

describe("tierDates", () => {
  it("records the workout that first crossed each threshold", () => {
    const ws = [
      workout(0, [{ exerciseId: "a", sets: [set(60, 5)] }]),
      workout(10, [
        { exerciseId: "a", sets: [set(140, 3)] },
        { exerciseId: "b", sets: [set(140, 3)] },
        { exerciseId: "c", sets: [set(140, 3)] },
      ]),
    ];
    const d = tierDates(ws, "kg", body);
    expect(d.get("Rust")).toBe(T0 + 3600000);
    // The big session is what lifted the overall score past the middle tiers.
    expect(d.get("Silver")).toBe(T0 + 10 * DAY + 3600000);
  });

  it("keeps a tier once reached, even if points later fall", () => {
    const ws = [
      workout(0, [
        { exerciseId: "a", sets: [set(140, 3)] },
        { exerciseId: "b", sets: [set(140, 3)] },
        { exerciseId: "c", sets: [set(140, 3)] },
      ]),
      workout(60, [{ exerciseId: "a", sets: [set(60, 5)] }]),
    ];
    // Bodyweight balloons, so DOTS for the same lifts drops hard.
    const growing = (ms: number) => ({
      weightKg: 80 + ((ms - T0) / DAY) * 1.2,
      sex: "male" as const,
    });
    const d = tierDates(ws, "kg", growing);
    const reached = d.get("Silver");
    expect(reached).toBe(T0 + 3600000);
  });

  it("leaves unreached tiers absent", () => {
    const ws = [workout(0, [{ exerciseId: "a", sets: [set(60, 5)] }])];
    const d = tierDates(ws, "kg", body);
    expect(d.has("World Class")).toBe(false);
  });
});
