/**
 * Social client (PATH.md Phase 3) — the thin typed layer over the tables in
 * supabase/social.sql. Everything here is friend-scoped by RLS on the
 * server; this module never assumes it can see more than it can.
 *
 * What leaves the device: a handle, a display name, and a COMPUTED rank
 * snapshot (points, tier, top lifts). Never workouts, never set data.
 *
 * Every call returns `{ data, error }` with an already-friendly error
 * string, so screens can render failures without a try/catch dance.
 */
import { supabase } from "./supabase";
import { bodyProfileAt } from "./calories";
import { overallRank, rankLifts, stageOf, type BestLift } from "./rank";
import type { Exercise, Measurement, Settings, Workout } from "../types";

export interface Profile {
  userId: string;
  handle: string;
  displayName: string;
  visible: boolean;
}

export interface RankSnapshot {
  userId: string;
  points: number;
  tier: string;
  stage: 1 | 2 | 3 | 4;
  lifts: SnapshotLift[];
  bodyweightKg: number | null;
  sex: "male" | "female" | null;
  updatedAt: string;
}

export interface SnapshotLift {
  name: string;
  e1RM: number;
  unit: string;
  points: number;
  tier: string;
}

/** A friend as the Friends list needs them: who they are + where they rank. */
export interface Friend {
  /** friendships.id — the row to delete when unfriending. */
  edgeId: string;
  userId: string;
  handle: string;
  displayName: string;
  snapshot: RankSnapshot | null;
}

export interface FriendRequest {
  edgeId: string;
  userId: string;
  handle: string;
  displayName: string;
  /** "in" = they asked you; "out" = you asked them. */
  direction: "in" | "out";
}

export type Result<T> = { data: T | null; error: string | null };

const OFFLINE: string = "No connection — friends need the internet.";

function fail<T>(message: string): Result<T> {
  return { data: null, error: message };
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("handle_format"))
    return "Handles are 3–20 characters: lowercase letters, numbers and _.";
  if (m.includes("profiles_handle_key") || m.includes("duplicate key") && m.includes("handle"))
    return "That handle is taken.";
  if (m.includes("one_row_per_pair") || m.includes("duplicate key"))
    return "You already have a request with them.";
  if (m.includes("no_self_friendship")) return "That's you.";
  if (m.includes("network") || m.includes("fetch")) return OFFLINE;
  return message || "Something went wrong.";
}

/** Handle rules, mirrored from the DB's check constraint. */
export function handleOk(handle: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(handle.trim().toLowerCase());
}

/** Suggest a handle from a display name ("Adilzhan Y" → "adilzhan_y"). */
export function suggestHandle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

// ── profile ────────────────────────────────────────────────────────────────

export async function myProfile(): Promise<Result<Profile | null>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const { data, error } = await sb
    .from("profiles")
    .select("user_id, handle, display_name, visible")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return fail(friendly(error.message));
  return {
    data: data
      ? {
          userId: data.user_id,
          handle: data.handle,
          displayName: data.display_name,
          visible: data.visible,
        }
      : null,
    error: null,
  };
}

/** Create or update your public profile. Publishing is what makes you findable. */
export async function saveProfile(
  handle: string,
  displayName: string,
  visible = true,
): Promise<Result<Profile>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const clean = handle.trim().toLowerCase();
  if (!handleOk(clean))
    return fail("Handles are 3–20 characters: lowercase letters, numbers and _.");
  const { data, error } = await sb
    .from("profiles")
    .upsert(
      {
        user_id: auth.user.id,
        handle: clean,
        display_name: displayName.trim(),
        visible,
      },
      { onConflict: "user_id" },
    )
    .select("user_id, handle, display_name, visible")
    .single();
  if (error) return fail(friendly(error.message));
  return {
    data: {
      userId: data.user_id,
      handle: data.handle,
      displayName: data.display_name,
      visible: data.visible,
    },
    error: null,
  };
}

export async function handleTaken(handle: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { data } = await sb.rpc("handle_taken", { p_handle: handle.trim().toLowerCase() });
  return data === true;
}

// ── rank snapshot ──────────────────────────────────────────────────────────

/**
 * Publish the computed rank. Called after a workout finishes and whenever
 * the Friends screen opens, so a friend list is never stale by more than a
 * session.
 */
export async function publishSnapshot(input: {
  points: number;
  tier: string;
  stage: 1 | 2 | 3 | 4;
  lifts: (BestLift & { name: string })[];
  unit: string;
  bodyweightKg: number;
  sex: "male" | "female";
}): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const lifts: SnapshotLift[] = input.lifts.slice(0, 5).map((l) => ({
    name: l.name,
    e1RM: l.e1RM,
    unit: input.unit,
    points: Math.round(l.points * 10) / 10,
    tier: l.tier.tier,
  }));
  const { error } = await sb.from("rank_snapshots").upsert(
    {
      user_id: auth.user.id,
      points: Math.round(input.points * 10) / 10,
      tier: input.tier,
      stage: input.stage,
      lifts,
      bodyweight_kg: Math.round(input.bodyweightKg * 10) / 10,
      sex: input.sex,
    },
    { onConflict: "user_id" },
  );
  if (error) return fail(friendly(error.message));
  return { data: true, error: null };
}

/**
 * Compute the rank from local data and publish it. Called after every
 * finished workout (the only thing that can move a rank) and whenever the
 * Friends screen opens. Silent by design: signed out, offline, or "no
 * eligible lifts yet" are all normal, not errors worth a banner.
 */
export async function publishRankFromData(source: {
  workouts: Workout[];
  exercises: Exercise[];
  measurements: Measurement[];
  settings: Settings;
}): Promise<void> {
  const { workouts, exercises, measurements, settings } = source;
  const body = bodyProfileAt(settings, measurements, Date.now());
  const lifts = rankLifts(workouts, settings.unit, body.weightKg, body.sex);
  if (lifts.length === 0) return;
  const overall = overallRank(lifts);
  await publishSnapshot({
    points: overall.state.points,
    tier: overall.state.tier,
    stage: stageOf(overall.state.progress),
    lifts: lifts.slice(0, 5).map((l) => ({
      ...l,
      name: exercises.find((e) => e.id === l.exerciseId)?.name ?? "Exercise",
    })),
    unit: settings.unit,
    bodyweightKg: body.weightKg,
    sex: body.sex,
  });
}

// ── friends ────────────────────────────────────────────────────────────────

type EdgeRow = { id: string; requester: string; addressee: string; status: string };

/** One round trip for the edges, then one each for names and snapshots. */
async function loadEdges(): Promise<Result<{ me: string; edges: EdgeRow[] }>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const { data, error } = await sb
    .from("friendships")
    .select("id, requester, addressee, status")
    .neq("status", "blocked");
  if (error) return fail(friendly(error.message));
  return { data: { me: auth.user.id, edges: (data ?? []) as EdgeRow[] }, error: null };
}

async function profilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  const sb = supabase();
  if (!sb || ids.length === 0) return out;
  const { data } = await sb
    .from("profiles")
    .select("user_id, handle, display_name, visible")
    .in("user_id", ids);
  for (const p of data ?? [])
    out.set(p.user_id, {
      userId: p.user_id,
      handle: p.handle,
      displayName: p.display_name,
      visible: p.visible,
    });
  return out;
}

async function snapshotsByIds(ids: string[]): Promise<Map<string, RankSnapshot>> {
  const out = new Map<string, RankSnapshot>();
  const sb = supabase();
  if (!sb || ids.length === 0) return out;
  const { data } = await sb
    .from("rank_snapshots")
    .select("user_id, points, tier, stage, lifts, bodyweight_kg, sex, updated_at")
    .in("user_id", ids);
  for (const s of data ?? [])
    out.set(s.user_id, {
      userId: s.user_id,
      points: Number(s.points),
      tier: s.tier,
      stage: s.stage,
      lifts: (s.lifts ?? []) as SnapshotLift[],
      bodyweightKg: s.bodyweight_kg == null ? null : Number(s.bodyweight_kg),
      sex: s.sex,
      updatedAt: s.updated_at,
    });
  return out;
}

export interface FriendsView {
  friends: Friend[];
  requests: FriendRequest[];
}

/** Everything the Friends screen renders, in one call. */
export async function loadFriends(): Promise<Result<FriendsView>> {
  const base = await loadEdges();
  if (!base.data) return fail(base.error ?? OFFLINE);
  const { me, edges } = base.data;
  const other = (e: EdgeRow) => (e.requester === me ? e.addressee : e.requester);
  const ids = [...new Set(edges.map(other))];
  const [profiles, snaps] = await Promise.all([profilesByIds(ids), snapshotsByIds(ids)]);

  const friends: Friend[] = [];
  const requests: FriendRequest[] = [];
  for (const e of edges) {
    const id = other(e);
    const p = profiles.get(id);
    const handle = p?.handle ?? "unknown";
    const displayName = p?.displayName || handle;
    if (e.status === "accepted") {
      friends.push({ edgeId: e.id, userId: id, handle, displayName, snapshot: snaps.get(id) ?? null });
    } else if (e.status === "pending") {
      requests.push({
        edgeId: e.id,
        userId: id,
        handle,
        displayName,
        direction: e.requester === me ? "out" : "in",
      });
    }
  }
  friends.sort((a, b) => (b.snapshot?.points ?? -1) - (a.snapshot?.points ?? -1));
  // Incoming first — those are the ones needing an answer.
  requests.sort((a, b) => (a.direction === b.direction ? 0 : a.direction === "in" ? -1 : 1));
  return { data: { friends, requests }, error: null };
}

/** Look someone up by their exact handle (the only discovery path). */
export async function findProfile(handle: string): Promise<Result<Profile | null>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data, error } = await sb.rpc("find_profile", {
    p_handle: handle.trim().toLowerCase(),
  });
  if (error) return fail(friendly(error.message));
  const row = Array.isArray(data) ? data[0] : data;
  return {
    data: row
      ? { userId: row.user_id, handle: row.handle, displayName: row.display_name, visible: true }
      : null,
    error: null,
  };
}

/**
 * Ask to be someone's friend. Handles the crossing case first: if THEY
 * already asked you, adding them back is obviously an accept, not a second
 * request in the opposite direction (the unique constraint is on the
 * ordered pair, so both edges could otherwise exist at once).
 */
export async function sendRequest(userId: string): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const me = auth.user.id;

  const { data: existing, error: readErr } = await sb
    .from("friendships")
    .select("id, requester, addressee, status")
    .or(
      `and(requester.eq.${me},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${me})`,
    );
  if (readErr) return fail(friendly(readErr.message));

  const edge = (existing ?? [])[0] as
    | { id: string; requester: string; addressee: string; status: string }
    | undefined;
  if (edge) {
    if (edge.status === "accepted") return fail("You're already friends.");
    if (edge.status === "blocked") return fail("That request can't be sent.");
    // Pending: theirs to us → accept it; ours to them → nothing to do.
    if (edge.addressee === me) return acceptRequest(edge.id);
    return fail("Already asked — waiting for them to accept.");
  }

  const { error } = await sb
    .from("friendships")
    .insert({ requester: me, addressee: userId, status: "pending" });
  if (error) return fail(friendly(error.message));
  return { data: true, error: null };
}

export async function acceptRequest(edgeId: string): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { error } = await sb.from("friendships").update({ status: "accepted" }).eq("id", edgeId);
  if (error) return fail(friendly(error.message));
  return { data: true, error: null };
}

/** Declining, cancelling and unfriending are all "remove the edge". */
export async function removeEdge(edgeId: string): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { error } = await sb.from("friendships").delete().eq("id", edgeId);
  if (error) return fail(friendly(error.message));
  return { data: true, error: null };
}
