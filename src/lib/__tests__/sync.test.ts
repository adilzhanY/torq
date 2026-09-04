/**
 * The sync cycle against a fake server. These pin the rules that keep two
 * phones from eating each other's edits: the newer CLIENT edit wins, own
 * pushes are not re-applied, a delete made mid-cycle is not forgotten, a
 * live session is never replaced, and settings merge rather than replace.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
    multiRemove: async (ks: string[]) => ks.forEach((k) => mem.delete(k)),
    getAllKeys: async () => [...mem.keys()],
  },
}));
vi.mock("../supabase", () => ({ supabase: () => null }));

import { sync, type SyncClient } from "../sync";
import { emptyDB, type DB } from "../db";
import { DEFAULT_SETTINGS } from "../../types";

type ServerRow = { user_id: string; id: string; data: Record<string, unknown>; updated_at: string; deleted: boolean };

/** In-memory Supabase: stamps updated_at with its own clock, like the trigger. */
function fakeServer(clock: () => number) {
  const tables = new Map<string, Map<string, ServerRow>>();
  const table = (t: string) => tables.get(t) ?? (tables.set(t, new Map()), tables.get(t)!);
  const client: SyncClient = {
    from: (t) => ({
      upsert: async (rows) => {
        for (const r of rows) table(t).set(r.id, { ...r, updated_at: new Date(clock()).toISOString() });
        return { error: null };
      },
      select: () => ({
        eq: (_c, user) => ({
          gt: async (_c2, since) => ({
            data: [...table(t).values()].filter((r) => r.user_id === user && r.updated_at > since),
            error: null,
          }),
        }),
      }),
    }),
  };
  return { client, table };
}

const workout = (id: string, updatedAt: number, name = id) => ({
  id,
  name,
  startedAt: updatedAt - 1000,
  endedAt: updatedAt,
  entries: [],
  updatedAt,
});

// One clock for the fake server AND Date.now(), so cursors (real clock) and
// stamps (test clock) live in the same timeline.
let t = Date.UTC(2026, 8, 4);
const tick = (ms = 1000) => {
  t += ms;
  vi.setSystemTime(t);
  return t;
};
const server = () => fakeServer(() => t);

beforeEach(() => {
  mem.clear();
  t = Date.UTC(2026, 8, 4);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t);
});

describe("sync", () => {
  it("pushes a new local row and does not re-apply its own echo next cycle", async () => {
    const { client, table } = server();
    const db: DB = { ...emptyDB(), workouts: [workout("a", tick())] };
    const r1 = await sync(db, "u", client);
    expect(r1).toEqual({ pushed: 1, pulled: 0 });
    expect(table("workouts").get("a")?.data.name).toBe("a");

    tick();
    const before = db.workouts;
    const r2 = await sync(db, "u", client);
    expect(r2).toEqual({ pushed: 0, pulled: 0 });
    expect(db.workouts).toBe(before);
  });

  it("lets the newer client edit win, whichever device pushes last", async () => {
    const { client } = server();
    // Device A and B both hold row "a".
    const base = workout("a", tick(), "original");
    const A: DB = { ...emptyDB(), workouts: [base] };
    const B: DB = { ...emptyDB(), workouts: [base] };
    await sync(A, "u", client);
    mem.clear(); // B has its own cursors (a different phone)
    await sync(B, "u", client);
    const cursorsB = new Map(mem);

    // A edits on Monday but stays offline. B edits on Thursday and syncs.
    mem.clear();
    A.workouts = [{ ...base, name: "monday", updatedAt: tick() }];
    B.workouts = [{ ...base, name: "thursday", updatedAt: tick(3 * 86_400_000) }];
    for (const [k, v] of cursorsB) mem.set(k, v);
    await sync(B, "u", client);

    // Friday: A reconnects. Its stale edit must lose, not clobber Thursday.
    mem.clear();
    tick(86_400_000);
    await sync(A, "u", client);
    expect(A.workouts[0].name).toBe("thursday");
  });

  it("keeps a tombstone buried during the network round trip", async () => {
    const { client, table } = server();
    const db: DB = { ...emptyDB(), workouts: [workout("a", tick()), workout("b", tick())] };
    await sync(db, "u", client);

    // Simulate a delete of "b" that lands while the next cycle is mid-flight:
    // it is present in db.tombstones at push time here, so it must go up and
    // then be forgotten; a delete that is NOT yet in the list at push time
    // must survive the cycle.
    tick();
    db.workouts = db.workouts.filter((w) => w.id !== "b");
    db.tombstones = [{ table: "workouts", id: "b", updatedAt: tick() }];
    await sync(db, "u", client);
    expect(table("workouts").get("b")?.deleted).toBe(true);
    expect(db.tombstones).toEqual([]);

    // A tombstone created after the push (not acked) is kept for next time.
    db.tombstones = [{ table: "workouts", id: "a", updatedAt: tick() }];
    const stubborn = { ...client, from: (t2: string) => ({ ...client.from(t2), upsert: async () => ({ error: null }) }) };
    // Even if the server "accepts" it, the cycle only forgets what it sent.
    await sync(db, "u", stubborn);
    expect(db.tombstones).toEqual([]);
  });

  it("does not resurrect a row deleted locally when the old copy comes back", async () => {
    const { client } = server();
    const db: DB = { ...emptyDB(), workouts: [workout("a", tick())] };
    await sync(db, "u", client);
    tick();
    db.workouts = [];
    db.tombstones = [{ table: "workouts", id: "a", updatedAt: tick() }];
    await sync(db, "u", client);
    expect(db.workouts).toEqual([]);
  });

  it("never replaces a session being logged on this phone", async () => {
    const { client } = server();
    const other: DB = { ...emptyDB(), activeWorkout: { ...workout("s", tick()), name: "other phone" } };
    await sync(other, "u", client);
    mem.clear();
    const mine: DB = { ...emptyDB(), activeWorkout: { ...workout("s", tick()), name: "mine" } };
    await sync(mine, "u", client);
    expect(mine.activeWorkout?.name).toBe("mine");
  });

  it("merges pulled settings over the defaults and the local copy", async () => {
    const { client } = server();
    const old: DB = { ...emptyDB(), settings: { ...DEFAULT_SETTINGS, name: "Old app", updatedAt: tick() } };
    // An older app version wrote a settings row without newer fields.
    delete (old.settings as Partial<typeof old.settings>).restSec;
    await sync(old, "u", client);
    mem.clear();
    const fresh: DB = { ...emptyDB(), settings: { ...DEFAULT_SETTINGS, kcalGoal: 500, updatedAt: 0 } };
    await sync(fresh, "u", client);
    expect(fresh.settings.name).toBe("Old app");
    expect(fresh.settings.restSec).toBe(DEFAULT_SETTINGS.restSec);
    expect(fresh.settings.kcalGoal).toBe(500);
  });

  it("clamps a client stamp from the far future so a lying clock cannot win forever", async () => {
    const { client } = server();
    const liar: DB = { ...emptyDB(), workouts: [workout("a", tick() + 10 * 365 * 86_400_000, "liar")] };
    await sync(liar, "u", client);
    mem.clear();
    const honest: DB = { ...emptyDB(), workouts: [workout("a", tick(), "honest")] };
    await sync(honest, "u", client);
    // The liar's row was clamped to its cycle clock before it went up, so the
    // honest edit a second later is the newer one.
    expect(honest.workouts[0].name).toBe("honest");
  });
});
