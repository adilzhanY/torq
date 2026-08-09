import { describe, expect, it } from "vitest";
import { computePRs, prTotals } from "../stats";
import type { Workout, WorkoutSet } from "../../types";

const DAY = 86400000;
const T0 = new Date(2026, 0, 1).getTime();

function set(weight: number, reps: number, type: WorkoutSet["type"] = "normal"): WorkoutSet {
  return { type, weight, reps, done: true };
}

function w(
  id: string,
  at: number,
  entries: { exerciseId: string; sets: WorkoutSet[] }[],
): Workout {
  return { id, name: id, startedAt: at, endedAt: at + 3600000, entries, updatedAt: at };
}

/** The property that matters: the fast path must equal the slow one. */
function expectAgrees(list: Workout[]) {
  const fast = prTotals(list);
  for (const one of list) {
    expect(fast.get(one.id)).toBe(computePRs(one, list).total);
  }
}

describe("prTotals", () => {
  it("agrees with computePRs on a rising history", () => {
    const list = [
      w("a", T0, [{ exerciseId: "sq", sets: [set(100, 5), set(105, 5)] }]),
      w("b", T0 + DAY, [{ exerciseId: "sq", sets: [set(110, 5)] }]),
      w("c", T0 + 2 * DAY, [{ exerciseId: "sq", sets: [set(90, 12)] }]),
    ];
    expectAgrees(list);
  });

  it("agrees when the list is not in chronological order", () => {
    const list = [
      w("c", T0 + 2 * DAY, [{ exerciseId: "b", sets: [set(60, 8)] }]),
      w("a", T0, [{ exerciseId: "b", sets: [set(50, 8)] }]),
      w("b", T0 + DAY, [{ exerciseId: "b", sets: [set(55, 8)] }]),
    ];
    expectAgrees(list);
  });

  it("agrees across several exercises and warmups", () => {
    const list = [
      w("a", T0, [
        { exerciseId: "sq", sets: [set(200, 3, "warmup"), set(100, 5)] },
        { exerciseId: "bp", sets: [set(60, 5)] },
      ]),
      w("b", T0 + DAY, [
        { exerciseId: "sq", sets: [set(102, 5)] },
        { exerciseId: "bp", sets: [set(59, 6)] },
      ]),
      w("c", T0 + 2 * DAY, [{ exerciseId: "dl", sets: [set(140, 3)] }]),
    ];
    expectAgrees(list);
  });

  it("agrees when two sessions share a start time", () => {
    const list = [
      w("a", T0, [{ exerciseId: "sq", sets: [set(100, 5)] }]),
      w("tie1", T0 + DAY, [{ exerciseId: "sq", sets: [set(110, 5)] }]),
      w("tie2", T0 + DAY, [{ exerciseId: "sq", sets: [set(115, 5)] }]),
      w("later", T0 + 2 * DAY, [{ exerciseId: "sq", sets: [set(112, 5)] }]),
    ];
    // Both tied sessions judge against the state BEFORE either of them.
    expectAgrees(list);
    expect(prTotals(list).get("tie1")).toBeGreaterThan(0);
    expect(prTotals(list).get("tie2")).toBeGreaterThan(0);
  });

  it("agrees on a long pseudo-random history", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const list: Workout[] = [];
    for (let i = 0; i < 40; i++) {
      const ex = ["sq", "bp", "dl"][Math.floor(rnd() * 3)];
      list.push(
        w(`w${i}`, T0 + i * DAY, [
          {
            exerciseId: ex,
            sets: [set(60 + Math.round(rnd() * 60), 1 + Math.floor(rnd() * 10))],
          },
        ]),
      );
    }
    expectAgrees(list);
  });

  it("is empty for an empty history", () => {
    expect(prTotals([]).size).toBe(0);
  });
});
