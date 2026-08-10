/**
 * Streaks are motivational, so being WRONG in the harsh direction (telling
 * someone they lost a streak they still have) is the expensive failure.
 * The rule: a streak breaks only after 3 consecutive missed planned days.
 */
import { describe, expect, it } from "vitest";
import { computeStreak } from "../streak";
import type { Routine, Workout } from "../../types";

const DAY = 86400000;

/** Local midnight, n days before `from`. */
function dayBefore(from: number, n: number): number {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n).getTime();
}

function plan(weekdays: number[]): Routine[] {
  return weekdays.map((weekday, i) => ({
    id: `r${i}`,
    name: `Day ${weekday}`,
    entries: [],
    plan: true,
    weekday,
    updatedAt: 0,
  }));
}

function sessions(days: number[], now: number): Workout[] {
  return days.map((n, i) => ({
    id: `w${i}`,
    name: "Session",
    startedAt: dayBefore(now, n) + 10 * 3600000,
    endedAt: dayBefore(now, n) + 11 * 3600000,
    entries: [],
    updatedAt: 0,
  }));
}

// A fixed Wednesday noon, so weekday maths is stable regardless of when the
// suite runs.
const NOW = new Date(2026, 7, 5, 12, 0, 0).getTime();

describe("computeStreak", () => {
  it("has no opinion without a plan", () => {
    const s = computeStreak(sessions([0, 1, 2], NOW), [], NOW);
    expect(s.hasPlan).toBe(false);
    expect(s.current).toBe(0);
  });

  it("counts consecutive training days", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    const s = computeStreak(sessions([0, 1, 2, 3], NOW), everyDay, NOW);
    expect(s.hasPlan).toBe(true);
    expect(s.current).toBe(4);
  });

  it("counts a day once even when two sessions land on it", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    const s = computeStreak(sessions([0, 0, 1], NOW), everyDay, NOW);
    expect(s.current).toBe(2);
  });

  it("tolerates scattered misses, one skipped day does not reset it", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    // Trained 0,1,3,4: missed day 2 only.
    const s = computeStreak(sessions([0, 1, 3, 4], NOW), everyDay, NOW);
    expect(s.current).toBe(4);
  });

  it("breaks after three consecutive missed planned days", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    // Trained today, then nothing for days 1-3, then trained days 4-5.
    const s = computeStreak(sessions([0, 4, 5], NOW), everyDay, NOW);
    expect(s.current).toBe(1);
  });

  it("does not punish rest days", () => {
    // Plan trains Mon/Wed/Fri only; the gaps are rest, not misses.
    const mwf = plan([1, 3, 5]);
    const now = new Date(2026, 7, 7, 12, 0, 0).getTime(); // a Friday
    const s = computeStreak(sessions([0, 2, 4], now), mwf, now);
    expect(s.current).toBe(3);
  });

  it("does not count today as missed while the day is still young", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    // Nothing logged today, but yesterday and before are fine.
    const s = computeStreak(sessions([1, 2, 3], NOW), everyDay, NOW);
    expect(s.current).toBe(3);
  });

  it("reports zero for someone who has never trained", () => {
    const s = computeStreak([], plan([1, 3, 5]), NOW);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(0);
  });

  it("remembers the longest streak even after the current one breaks", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    // A 5-day run, a 4-day hole, then today.
    const s = computeStreak(sessions([0, 5, 6, 7, 8, 9], everyDay.length ? NOW : NOW), everyDay, NOW);
    expect(s.longest).toBeGreaterThanOrEqual(5);
    expect(s.current).toBe(1);
  });

  it("ignores unfinished sessions", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    const live = sessions([0], NOW).map((w) => ({ ...w, endedAt: undefined }));
    expect(computeStreak(live, everyDay, NOW).current).toBe(0);
  });

  it("ignores archived plan routines when deciding which days are planned", () => {
    const archived = plan([1, 3, 5]).map((r) => ({ ...r, archived: true }));
    expect(computeStreak(sessions([0], NOW), archived, NOW).hasPlan).toBe(false);
  });

  it("never returns a current streak longer than the longest", () => {
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    for (const days of [[0], [0, 1], [0, 1, 2, 5, 6], [3, 4, 5]]) {
      const s = computeStreak(sessions(days, NOW), everyDay, NOW);
      expect(s.current).toBeLessThanOrEqual(s.longest);
    }
  });

  it("uses calendar days, so a DST shift cannot drop one", () => {
    // Late March in Europe crosses a DST boundary; 24h arithmetic drifts here.
    const dst = new Date(2026, 2, 30, 12, 0, 0).getTime();
    const everyDay = plan([0, 1, 2, 3, 4, 5, 6]);
    expect(computeStreak(sessions([0, 1, 2], dst), everyDay, dst).current).toBe(3);
    expect(DAY).toBe(86400000);
  });
});
