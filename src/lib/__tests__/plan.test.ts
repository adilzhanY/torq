/**
 * The plan generator is the "coach, not notebook" pivot: whatever the user
 * answers in onboarding, it must produce a usable week. The exhaustive sweep
 * at the bottom is the real test, that shape of check is what caught flat
 * 5x5 producing two-hour strength sessions during development.
 */
import { describe, expect, it } from "vitest";
import { buildPlan, clampDays, mondayFirst, planDayMinutes } from "../plan";
import { DB_BY_ID } from "../exercisedb";
import type { BodyPart, PlanGoal } from "../../types";

const GOALS: PlanGoal[] = ["muscle", "lean", "strength", "fit"];
const SESSION_CAP_MIN = 90;

describe("mondayFirst", () => {
  it("orders a week starting on Monday, not Sunday", () => {
    // 0 = Sunday, so Sunday must sort last.
    expect(mondayFirst([0, 1, 3])).toEqual([1, 3, 0]);
    expect(mondayFirst([6, 2])).toEqual([2, 6]);
  });
});

describe("clampDays", () => {
  it("keeps the split count inside what the generator defines", () => {
    expect(clampDays(0)).toBe(2);
    expect(clampDays(1)).toBe(2);
    expect(clampDays(4)).toBe(4);
    expect(clampDays(9)).toBe(6);
  });
});

describe("buildPlan", () => {
  it("produces one day per chosen training day, on those weekdays", () => {
    for (const days of [[1, 3], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]]) {
      const plan = buildPlan({ goal: "muscle", weekdays: days, focus: [], createdAt: 0 });
      expect(plan.length, `${days.length} days`).toBe(days.length);
      expect(plan.map((d) => d.weekday).sort((a, b) => a - b)).toEqual([...days].sort((a, b) => a - b));
    }
  });

  it("is deterministic, same answers, same plan", () => {
    const prefs = { goal: "muscle" as const, weekdays: [1, 3, 5], focus: [] as BodyPart[], createdAt: 0 };
    expect(buildPlan(prefs)).toEqual(buildPlan(prefs));
  });

  it("names every day and fills it with real catalog exercises", () => {
    const plan = buildPlan({ goal: "muscle", weekdays: [1, 3, 5], focus: [], createdAt: 0 });
    for (const day of plan) {
      expect(day.name.length).toBeGreaterThan(0);
      expect(day.items.length).toBeGreaterThan(0);
      for (const item of day.items) {
        // Catalog names carry mojibake, so plan slots reference verified
        // dbIds, a missing one must never reach the user as a blank row.
        expect(DB_BY_ID[item.dbId], item.dbId).toBeTruthy();
        expect(item.sets).toBeGreaterThan(0);
        expect(item.reps).toBeGreaterThan(0);
        expect(item.restSec).toBeGreaterThan(0);
      }
    }
  });

  it("runs heavy low-rep work first on a strength plan", () => {
    const plan = buildPlan({ goal: "strength", weekdays: [1, 3, 5], focus: [], createdAt: 0 });
    expect(plan[0].items[0].reps).toBeLessThanOrEqual(6);
  });

  it("prescribes more reps for lean than for strength", () => {
    const avgReps = (goal: PlanGoal) => {
      const items = buildPlan({ goal, weekdays: [1, 3, 5], focus: [], createdAt: 0 }).flatMap((d) => d.items);
      return items.reduce((s, i) => s + i.reps, 0) / items.length;
    };
    expect(avgReps("lean")).toBeGreaterThan(avgReps("strength"));
  });

  it("adds work for a focused body part", () => {
    const total = (focus: BodyPart[]) =>
      buildPlan({ goal: "muscle", weekdays: [1, 3, 5], focus, createdAt: 0 })
        .flatMap((d) => d.items)
        .reduce((s, i) => s + i.sets, 0);
    expect(total(["arms"])).toBeGreaterThan(total([]));
  });

  it("still returns a usable week when the user picks no days", () => {
    // clampDays floors at 2 rather than handing back an empty plan.
    const plan = buildPlan({ goal: "muscle", weekdays: [], focus: [], createdAt: 0 });
    expect(plan.length).toBe(2);
    expect(plan.every((d) => d.items.length > 0)).toBe(true);
  });

  /**
   * The sweep: every goal x every 2-6 day subset x several focus
   * combinations. No day may be empty, over the session cap, or reference a
   * catalog row that does not exist.
   */
  it("produces a sane week for every combination of answers", () => {
    const focusOptions: BodyPart[][] = [[], ["chest"], ["arms", "legs"], ["back", "shoulders", "core"]];
    const problems: string[] = [];
    let combos = 0;

    for (const goal of GOALS) {
      for (let mask = 0; mask < 128; mask++) {
        const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d));
        if (days.length < 2 || days.length > 6) continue;
        for (const focus of focusOptions) {
          combos++;
          const plan = buildPlan({ goal, weekdays: days, focus, createdAt: 0 });
          const where = `${goal}/${days.join("")}/${focus.join("+") || "none"}`;
          if (plan.length !== days.length) problems.push(`${where}: ${plan.length} days`);
          for (const day of plan) {
            if (day.items.length === 0) problems.push(`${where}: empty day`);
            const mins = planDayMinutes(day.items);
            if (mins > SESSION_CAP_MIN) problems.push(`${where}: ${mins}min session`);
            for (const item of day.items) {
              if (!DB_BY_ID[item.dbId]) problems.push(`${where}: missing ${item.dbId}`);
            }
          }
        }
      }
    }

    expect(combos).toBeGreaterThan(1000);
    expect(problems).toEqual([]);
  });
});
