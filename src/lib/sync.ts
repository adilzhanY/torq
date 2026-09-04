/**
 * Delta sync against Supabase: each row is
 * { user_id, id, data jsonb, updated_at, deleted }, last-write-wins by
 * updatedAt. Operates on the in-memory DB object (the store commits after).
 * Ported from grit mobile: the mirror-table pattern is domain-agnostic.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { REMOTE_TABLE, type DB, type SyncedTable } from "./db";
import { DEFAULT_SETTINGS } from "../types";

export interface SyncResult {
  pushed: number;
  pulled: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

/** Per-table local accessors over the DB object. */
function collection(db: DB, name: SyncedTable): {
  rows: () => Row[];
  upsert: (row: Row) => void;
  del: (id: string) => void;
} {
  switch (name) {
    case "settings":
      return {
        rows: () => [db.settings],
        // Merge, never replace: a row written by an older app version would
        // otherwise drop every newer field (unit, deloadUntil, kcalGoal).
        upsert: (row) => { db.settings = { ...DEFAULT_SETTINGS, ...db.settings, ...row }; },
        del: () => {},
      };
    case "active":
      return {
        rows: () => (db.activeWorkout ? [db.activeWorkout] : []),
        upsert: (row) => { db.activeWorkout = row; },
        del: () => { db.activeWorkout = null; },
      };
    default: {
      const key = name as Exclude<SyncedTable, "settings" | "active">;
      return {
        rows: () => db[key] as Row[],
        upsert: (row) => {
          // New array identity so memoised screens notice a pulled change.
          const arr = [...(db[key] as Row[])];
          const i = arr.findIndex((r) => r.id === row.id);
          if (i >= 0) arr[i] = row;
          else arr.push(row);
          (db[key] as Row[]) = arr;
        },
        del: (id) => { (db[key] as Row[]) = (db[key] as Row[]).filter((r) => r.id !== id); },
      };
    }
  }
}

// Push cursor (this device's clock) selects our own dirty rows. Pull cursor
// tracks the max *server* updated_at seen, so pulling is immune to clock skew
// between devices (the server stamps updated_at via a trigger, see
// supabase/schema.sql).
const pushKey = (userId: string) => `torq.sync.${userId}.at`;
const pullKey = (userId: string) => `torq.sync.${userId}.pull`;

// Largest epoch-ms a JS Date can represent; beyond it new Date(n).toISOString()
// throws RangeError. Treat any invalid/out-of-range cursor as 0 → a one-time
// full re-pull that re-converges and clears the bad value.
const MAX_TS = 8.64e15;
async function getNum(key: string): Promise<number> {
  const n = Number((await AsyncStorage.getItem(key)) ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= MAX_TS ? n : 0;
}
async function setNum(key: string, ms: number): Promise<void> {
  await AsyncStorage.setItem(key, String(ms));
}

export async function resetSyncCursor(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([pushKey(userId), pullKey(userId)]);
}

let running = false;

const NAMES = Object.keys(REMOTE_TABLE) as SyncedTable[];

/**
 * A client stamp further in the future than this is a lying clock, not a
 * newer edit. Clamped before it is compared or pushed.
 */
const CLOCK_SLACK_MS = 5 * 60 * 1000;

/** The subset of the Supabase client sync uses, so tests can fake it. */
export interface SyncClient {
  from: (table: string) => {
    upsert: (rows: Row[], opts: { onConflict: string }) => PromiseLike<{ error: unknown }>;
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        gt: (col: string, v: string) => PromiseLike<{ data: Row[] | null; error: unknown }>;
      };
    };
  };
}

/**
 * One cycle. Order matters and is the fix for last-pusher-wins:
 *
 *  1. PULL everything the server has changed since our pull cursor.
 *  2. RESOLVE each pulled row against the local one on the CLIENT stamp
 *     (`data.updatedAt`, clamped): the newer edit wins whichever device it
 *     came from. The server's `updated_at` is only the pull cursor; it says
 *     when a row ARRIVED, not when it was edited, so a device reconnecting
 *     on Friday with Monday's edit no longer clobbers Thursday's.
 *  3. PUSH what is still locally dirty after that, plus tombstones.
 *  4. Forget only the tombstones the server acknowledged.
 */
export async function sync(
  db: DB,
  userId: string,
  client: SyncClient | null = supabase() as unknown as SyncClient | null,
): Promise<SyncResult | null> {
  const sb = client;
  if (!sb || running) return null;
  running = true;
  try {
    const pushSince = await getNum(pushKey(userId));
    const pullSince = await getNum(pullKey(userId));
    const startedAt = Date.now();
    const clamp = (ms: number) => Math.min(ms, startedAt + CLOCK_SLACK_MS);
    let maxSeen = pullSince;
    let pushed = 0;
    let pulled = 0;

    // Repair clock-skew corruption: a row stamped in the FUTURE reads as
    // "locally dirty" forever and wedges sync. Clamp any future stamp down to
    // the cycle clock so the row pushes once and then settles.
    for (const name of NAMES) {
      for (const r of collection(db, name).rows()) {
        if ((r.updatedAt ?? 0) > startedAt) r.updatedAt = startedAt;
      }
    }
    for (const t of db.tombstones) if (t.updatedAt > startedAt) t.updatedAt = startedAt;

    // ---- pull + resolve ----
    const sinceIso = new Date(pullSince).toISOString();
    const localTomb = new Set(db.tombstones.map((t) => `${t.table}/${t.id}`));
    for (const name of NAMES) {
      const { data, error } = await sb
        .from(REMOTE_TABLE[name])
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", sinceIso);
      if (error) throw error;
      if (!data?.length) continue;
      const coll = collection(db, name);
      const existing = new Map(coll.rows().map((r) => [String(r.id), r]));
      for (const row of data) {
        const remoteMs = new Date(row.updated_at).getTime();
        if (Number.isFinite(remoteMs) && remoteMs > maxSeen && remoteMs <= MAX_TS) {
          maxSeen = remoteMs;
        }
        const id = String(row.id);
        const local = existing.get(id);
        const localStamp = local?.updatedAt ?? 0;
        const locallyDirty = local !== undefined && localStamp > pushSince;

        if (row.deleted) {
          // A local unpushed edit outranks a remote delete: the edit is the
          // newer intent and pushes below, resurrecting the row on purpose.
          if (locallyDirty) continue;
          if (name === "active" && db.activeWorkout && localStamp > pushSince) continue;
          coll.del(id);
          pulled += 1;
          continue;
        }

        const remoteStamp = clamp(Number(row.data?.updatedAt ?? 0));
        // Our own push coming back: same stamp, same content. Skip it rather
        // than re-applying and re-stamping every row every cycle.
        if (local && remoteStamp === localStamp) continue;
        // Deleted here since we last pushed: the tombstone goes up below.
        if (localTomb.has(`${name}/${id}`)) continue;
        // Never replace a session being logged on this phone with another
        // device's copy, whatever the stamps say.
        if (name === "active" && db.activeWorkout && locallyDirty) continue;

        if (locallyDirty && localStamp >= remoteStamp) continue; // ours is newer
        // Remote is newer (or we have no unpushed edit): apply it. Keep the
        // CLIENT stamp so the row is not dirty against our push cursor unless
        // it genuinely is newer than the cursor.
        coll.upsert({ ...row.data, updatedAt: Math.min(remoteStamp, startedAt) });
        pulled += 1;
      }
    }

    // ---- push changed rows ----
    for (const name of NAMES) {
      const dirty = collection(db, name)
        .rows()
        .filter((r) => (r.updatedAt ?? 0) > pushSince);
      if (!dirty.length) continue;
      const payload = dirty.map((r) => ({
        id: String(r.id),
        user_id: userId,
        data: r,
        updated_at: new Date(r.updatedAt ?? Date.now()).toISOString(),
        deleted: false,
      }));
      const { error } = await sb.from(REMOTE_TABLE[name]).upsert(payload, { onConflict: "user_id,id" });
      if (error) throw error;
      pushed += payload.length;
    }

    // ---- push tombstones, forget only the acknowledged ones ----
    const acked = new Set<string>();
    for (const name of NAMES) {
      const list = db.tombstones.filter((t) => t.table === name);
      if (!list.length) continue;
      const payload = list.map((t) => ({
        id: String(t.id),
        user_id: userId,
        data: {},
        updated_at: new Date(t.updatedAt).toISOString(),
        deleted: true,
      }));
      const { error } = await sb.from(REMOTE_TABLE[name]).upsert(payload, { onConflict: "user_id,id" });
      if (error) throw error;
      pushed += payload.length;
      for (const t of list) acked.add(`${t.table}/${t.id}`);
    }
    // A tombstone buried while this cycle was awaiting the network is not in
    // `acked` and survives to the next cycle, instead of being dropped by a
    // timestamp comparison and letting the row come back.
    db.tombstones = db.tombstones.filter((t) => !acked.has(`${t.table}/${t.id}`));

    await setNum(pushKey(userId), startedAt);
    await setNum(pullKey(userId), Math.max(pullSince, maxSeen));
    return { pushed, pulled };
  } finally {
    running = false;
  }
}
