/**
 * Persistence is the one place a bug turns into lost training history, so
 * these pin the promises: a damaged blob is parked, never overwritten; a
 * malformed shape counts as damaged; a failed save is reported, not thrown;
 * overlapping saves coalesce; and a wipe waits for the pen to lift.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
let failWrites = false;
let writeDelay = 0;
let writes = 0;
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      writes += 1;
      if (writeDelay) await new Promise((r) => setTimeout(r, writeDelay));
      if (failWrites) throw new Error("disk full");
      mem.set(k, v);
    },
    multiRemove: async (ks: string[]) => ks.forEach((k) => mem.delete(k)),
    getAllKeys: async () => [...mem.keys()],
  },
}));

import { BACKUP_KEY, emptyDB, flushDB, getLoadFailure, getSaveFailure, loadDB, saveDB, wipeLocal } from "../db";

const KEY = "torq.db.v1";

beforeEach(() => {
  mem.clear();
  failWrites = false;
  writeDelay = 0;
  writes = 0;
});

describe("loadDB", () => {
  it("treats a missing key as a new install, not a failure", async () => {
    const db = await loadDB();
    expect(db.workouts).toEqual([]);
    expect(getLoadFailure()).toBeNull();
  });

  it("parks an unparseable blob and flags the failure", async () => {
    mem.set(KEY, "{not json");
    const db = await loadDB();
    expect(db.workouts).toEqual([]);
    expect(getLoadFailure()).not.toBeNull();
    expect(mem.get(BACKUP_KEY)).toBe("{not json");
  });

  it("treats a malformed shape as damage too", async () => {
    // Parses fine, would crash every consumer: workouts is not a list.
    mem.set(KEY, JSON.stringify({ workouts: null, settings: {} }));
    await loadDB();
    expect(getLoadFailure()).toMatch(/workouts/);
    expect(mem.get(BACKUP_KEY)).toContain("workouts");
  });

  it("fills in settings fields added after the blob was written", async () => {
    mem.set(KEY, JSON.stringify({ ...emptyDB(), settings: { id: "settings", name: "A" } }));
    const db = await loadDB();
    expect(db.settings.name).toBe("A");
    expect(db.settings.restSec).toBeGreaterThan(0);
  });
});

describe("saveDB", () => {
  it("reports a failed write instead of throwing", async () => {
    failWrites = true;
    await expect(saveDB(emptyDB())).resolves.toBeUndefined();
    expect(getSaveFailure()).toBe("disk full");
    failWrites = false;
    await saveDB(emptyDB());
    expect(getSaveFailure()).toBeNull();
  });

  it("coalesces a burst of saves into at most two writes, keeping the last", async () => {
    writeDelay = 5;
    const dbs = [1, 2, 3, 4, 5].map((n) => ({ ...emptyDB(), settings: { ...emptyDB().settings, name: `v${n}` } }));
    for (const db of dbs) void saveDB(db);
    await flushDB();
    expect(writes).toBeLessThanOrEqual(2);
    expect(JSON.parse(mem.get(KEY)!).settings.name).toBe("v5");
  });
});

describe("wipeLocal", () => {
  it("waits for an in-flight save so the wipe cannot be undone by it", async () => {
    writeDelay = 10;
    void saveDB(emptyDB());
    await wipeLocal();
    expect(mem.has(KEY)).toBe(false);
  });
});
