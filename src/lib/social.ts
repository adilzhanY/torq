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
import { overallRank, rankLifts, stageOf, TIER_NAMES, type BestLift } from "./rank";
import { checkLift } from "./plausibility";
import { LB_TO_KG } from "./units";
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

/** One tier change, as the feed renders it. */
export interface RankEvent {
  id: string;
  userId: string;
  kind: "overall" | "lift";
  liftName: string | null;
  fromTier: string;
  toTier: string;
  points: number;
  createdAt: string;
  /** Filled in by loadFeed from the profiles it already fetched. */
  handle: string;
  displayName: string;
  /** True when it's your own rank-up. */
  isMe: boolean;
}

export type Result<T> = { data: T | null; error: string | null };

const OFFLINE: string = "No connection — friends need the internet.";

/** How long a rank-up stays in the feed. */
const EVENT_TTL_DAYS = 90;

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
  const sb = supabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;

  const { workouts, exercises, measurements, settings } = source;
  const body = bodyProfileAt(settings, measurements, Date.now());
  const toKg = settings.unit === "lb" ? LB_TO_KG : 1;
  const all = rankLifts(workouts, settings.unit, body.weightKg, body.sex);

  // Plausibility gate on the way OUT only: a mistyped 1000 kg squat stays in
  // your own logs and your own Ranks screen, but it is not something we
  // publish to other people (PATH.md's "Liftoff lesson").
  const lifts = all.filter((l) => {
    const ex = exercises.find((e) => e.id === l.exerciseId);
    if (!ex) return false;
    return checkLift(ex.name, ex.equipment, l.e1RM * toKg, body.weightKg, body.sex).ok;
  });
  if (lifts.length === 0) return;
  const overall = overallRank(lifts);
  const named = lifts.slice(0, 5).map((l) => ({
    ...l,
    name: exercises.find((e) => e.id === l.exerciseId)?.name ?? "Exercise",
  }));

  // Read the PREVIOUS snapshot first: the feed is the diff between what the
  // server last knew and what we're about to publish.
  const { data: prev } = await sb
    .from("rank_snapshots")
    .select("tier, lifts")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const res = await publishSnapshot({
    points: overall.state.points,
    tier: overall.state.tier,
    stage: stageOf(overall.state.progress),
    lifts: named,
    unit: settings.unit,
    bodyweightKg: body.weightKg,
    sex: body.sex,
  });
  if (res.error) return;

  // No previous row means this is a first publish, not a promotion — a
  // brand-new user should not spray "Rust → Gold" across their friends' feed.
  if (!prev) return;

  // Only PROMOTIONS reach the feed. A tier can fall (gaining bodyweight
  // lowers DOTS for the same lift), and "@you reached Silver" would be a lie
  // on the way down — demotions are silent, by design.
  const rank = (t: string) => (TIER_NAMES as readonly string[]).indexOf(t);
  const promoted = (from: string, to: string) => rank(to) > rank(from) && rank(from) >= 0;

  const events: {
    user_id: string;
    kind: "overall" | "lift";
    lift_name: string | null;
    from_tier: string;
    to_tier: string;
    points: number;
  }[] = [];

  if (prev.tier && promoted(prev.tier, overall.state.tier)) {
    events.push({
      user_id: auth.user.id,
      kind: "overall",
      lift_name: null,
      from_tier: prev.tier,
      to_tier: overall.state.tier,
      points: Math.round(overall.state.points * 10) / 10,
    });
  }

  const before = new Map<string, string>();
  for (const l of (prev.lifts ?? []) as SnapshotLift[]) before.set(l.name, l.tier);
  for (const l of named) {
    const was = before.get(l.name);
    // Only movements we already knew about: a lift's first appearance is a
    // new entry, not a tier-up.
    if (was && promoted(was, l.tier.tier)) {
      events.push({
        user_id: auth.user.id,
        kind: "lift",
        lift_name: l.name,
        from_tier: was,
        to_tier: l.tier.tier,
        points: Math.round(l.points * 10) / 10,
      });
    }
  }

  // Tier changes are rare and the diff is against the stored row, so running
  // this on every publish stays idempotent — no duplicate events.
  if (events.length > 0) await sb.from("rank_events").insert(events);

  // Retention: nobody needs to see a rank-up from last spring, and the row
  // only exists to be read by friends. Each device prunes its OWN old rows
  // (the delete policy allows exactly that), so the table stays bounded
  // without a cron job.
  const cutoff = new Date(Date.now() - EVENT_TTL_DAYS * 86400000).toISOString();
  await sb.from("rank_events").delete().eq("user_id", auth.user.id).lt("created_at", cutoff);
}

/** Friends' (and your own) recent tier changes, newest first. */
export async function loadFeed(limit = 20): Promise<Result<RankEvent[]>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  // RLS already restricts this to you + accepted friends.
  const { data, error } = await sb
    .from("rank_events")
    .select("id, user_id, kind, lift_name, from_tier, to_tier, points, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(friendly(error.message));
  const rows = data ?? [];
  const profiles = await profilesByIds([...new Set(rows.map((r) => r.user_id))]);
  return {
    data: rows.map((r) => {
      const p = profiles.get(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        kind: r.kind,
        liftName: r.lift_name,
        fromTier: r.from_tier,
        toTier: r.to_tier,
        points: Number(r.points),
        createdAt: r.created_at,
        handle: p?.handle ?? (r.user_id === auth.user!.id ? "you" : "unknown"),
        displayName: p?.displayName || p?.handle || "You",
        isMe: r.user_id === auth.user!.id,
      };
    }),
    error: null,
  };
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
/**
 * Search opted-in profiles by handle or display name. Deliberately bounded:
 * the RPC needs 2+ characters, returns at most 20 rows, and exposes only a
 * handle and a name. See the privacy note in supabase/social.sql.
 */
export async function searchProfiles(query: string): Promise<Result<Profile[]>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const term = query.trim();
  if (term.length < 2) return { data: [], error: null };
  const { data, error } = await sb.rpc("search_profiles", { p_query: term });
  if (error) return fail(friendly(error.message));
  return {
    data: (data ?? []).map((r: { user_id: string; handle: string; display_name: string }) => ({
      userId: r.user_id,
      handle: r.handle,
      displayName: r.display_name || r.handle,
      visible: true,
    })),
    error: null,
  };
}

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
/**
 * Delete the account and every trace of it on the server. Play requires
 * this to exist in-app; the RPC only ever touches auth.uid()'s own rows.
 * The caller is responsible for wiping local data afterwards — the server
 * copy going away must not silently take the phone's copy with it.
 */
export async function deleteAccount(): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Sign in first.");
  const { error } = await sb.rpc("delete_my_account");
  if (error) return fail(friendly(error.message));
  // The JWT is dead the moment the row goes; clear it locally too.
  await sb.auth.signOut().catch(() => {});
  return { data: true, error: null };
}

export async function removeEdge(edgeId: string): Promise<Result<true>> {
  const sb = supabase();
  if (!sb) return fail(OFFLINE);
  const { error } = await sb.from("friendships").delete().eq("id", edgeId);
  if (error) return fail(friendly(error.message));
  return { data: true, error: null };
}
