import { describe, expect, it } from "vitest";
import { findGhost, ghostLabel, ghostProgress } from "../ghost";
import type { Workout, WorkoutSet } from "../../types";

const set = (weight: number, reps: number, done = true, type: WorkoutSet["type"] = "normal"): WorkoutSet =>
  ({ weight, reps, done, type });

function workout(
  id: string,
  entries: { exerciseId: string; sets: WorkoutSet[] }[],
  opts: { endedAt?: number; routineId?: string } = {},
): Workout {
  return {
    id,
    name: id,
    startedAt: (opts.endedAt ?? 0) - 3600_000,
    endedAt: opts.endedAt,
    routineId: opts.routineId,
    entries,
    updatedAt: 0,
  };
}

const DAY = 86400_000;

describe("findGhost", () => {
  const bench = { exerciseId: "bench", sets: [set(100, 5)] };
  const squat = { exerciseId: "squat", sets: [set(140, 5)] };

  it("prefers the most recent session from the same routine", () => {
    const old = workout("old", [bench], { endedAt: 1 * DAY, routineId: "push" });
    const recent = workout("recent", [bench], { endedAt: 5 * DAY, routineId: "push" });
    const other = workout("other", [bench], { endedAt: 6 * DAY, routineId: "pull" });
    const active = workout("live", [bench], { routineId: "push" });
    expect(findGhost([old, recent, other], active)?.id).toBe("recent");
  });

  it("falls back to the session sharing the most exercises", () => {
    // Quick-start sessions carry no routine id, which is exactly when the
    // fallback has to work.
    const half = workout("half", [bench], { endedAt: 4 * DAY });
    const both = workout("both", [bench, squat], { endedAt: 2 * DAY });
    const active = workout("live", [bench, squat]);
    expect(findGhost([half, both], active)?.id).toBe("both");
  });

  it("refuses a session that barely overlaps", () => {
    const unrelated = workout("unrelated", [{ exerciseId: "curl", sets: [set(20, 10)] }],
      { endedAt: 2 * DAY });
    const active = workout("live", [bench, squat, { exerciseId: "row", sets: [set(60, 8)] },
      { exerciseId: "dip", sets: [set(0, 10)] }]);
    expect(findGhost([unrelated], active)).toBeNull();
  });

  it("ignores unfinished sessions and itself", () => {
    const live = workout("live", [bench], { routineId: "push" });
    const alsoLive = workout("alsoLive", [bench], { routineId: "push" });
    expect(findGhost([live, alsoLive], live)).toBeNull();
  });

  it("returns null with no history", () => {
    expect(findGhost([], workout("live", [bench]))).toBeNull();
  });
});

describe("ghostProgress", () => {
  it("compares only the sets you have actually ticked", () => {
    const ghost = workout("g", [{ exerciseId: "bench", sets: [set(100, 5), set(100, 5), set(100, 5)] }],
      { endedAt: DAY });
    const active = workout("a", [{ exerciseId: "bench",
      sets: [set(110, 5), set(110, 5), set(110, 5, false)] }]);
    const p = ghostProgress(active, ghost);
    // Two sets in: 1100 against the ghost's 1000 at the same two positions,
    // NOT against its full 1500.
    expect(p.done).toBe(1100);
    expect(p.ghost).toBe(1000);
    expect(p.delta).toBe(100);
    expect(p.ghostTotal).toBe(1500);
  });

  it("names the ghost's set for the one you are about to do", () => {
    const ghost = workout("g", [{ exerciseId: "bench", sets: [set(100, 5), set(100, 8)] }],
      { endedAt: DAY });
    const active = workout("a", [{ exerciseId: "bench", sets: [set(100, 5), set(0, 0, false)] }]);
    expect(ghostProgress(active, ghost).next).toEqual({ exerciseId: "bench", weight: 100, reps: 8 });
  });

  it("skips warm-ups on both sides so positions stay aligned", () => {
    // The ghost ramped in one warm-up, this session in two. Working set 1
    // must still face working set 1.
    const ghost = workout("g", [{ exerciseId: "bench",
      sets: [set(40, 5, true, "warmup"), set(100, 5)] }], { endedAt: DAY });
    const active = workout("a", [{ exerciseId: "bench",
      sets: [set(20, 5, true, "warmup"), set(60, 3, true, "warmup"), set(105, 5)] }]);
    const p = ghostProgress(active, ghost);
    expect(p.done).toBe(525);
    expect(p.ghost).toBe(500);
  });

  it("scores zero for exercises the ghost never did", () => {
    const ghost = workout("g", [{ exerciseId: "bench", sets: [set(100, 5)] }], { endedAt: DAY });
    const active = workout("a", [
      { exerciseId: "bench", sets: [set(100, 5)] },
      { exerciseId: "flye", sets: [set(20, 12)] },
    ]);
    const p = ghostProgress(active, ghost);
    // The new exercise is pure gain: you did work the ghost never did.
    expect(p.done).toBe(740);
    expect(p.ghost).toBe(500);
    expect(p.delta).toBe(240);
  });

  it("is zero before the first tick", () => {
    const ghost = workout("g", [{ exerciseId: "bench", sets: [set(100, 5)] }], { endedAt: DAY });
    const active = workout("a", [{ exerciseId: "bench", sets: [set(100, 5, false)] }]);
    const p = ghostProgress(active, ghost);
    expect(p.done).toBe(0);
    expect(p.ghost).toBe(0);
    expect(p.delta).toBe(0);
  });

  it("counts extra sets beyond what the ghost did", () => {
    const ghost = workout("g", [{ exerciseId: "bench", sets: [set(100, 5)] }], { endedAt: DAY });
    const active = workout("a", [{ exerciseId: "bench", sets: [set(100, 5), set(100, 5)] }]);
    const p = ghostProgress(active, ghost);
    expect(p.done).toBe(1000);
    expect(p.ghost).toBe(500);
  });
});

describe("ghostLabel", () => {
  it("reads as a date you would recognise", () => {
    expect(ghostLabel(workout("g", [], { endedAt: Date.UTC(2026, 7, 3, 12) }))).toBe("Aug 3");
  });
});
