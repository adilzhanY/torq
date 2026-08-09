/**
 * Friends (PATH.md Phase 3, friends-first): your circle's ranks side by
 * side. Lives inside the Ranks tab behind the You / Friends switch.
 *
 * Three states, in order of how far along the user is:
 *  1. guest — nothing to sync with, offer the account;
 *  2. no public profile — claim a handle (this is the opt-in);
 *  3. the list — pending requests first, then friends by points.
 *
 * Discovery is exact-handle only (see find_profile in supabase/social.sql):
 * no browsing, no enumeration. Opening the screen also republishes YOUR
 * snapshot, so a friend list is never more than a session stale.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "../components/KeyboardAware";
import { C, FONT, R } from "../theme";
import { Icon } from "../components/Icon";
import { RankBadge } from "../components/RankBadge";
import { Avatar } from "../components/Avatar";
import { PopIn } from "../components/anim";
import { ConfirmDialog } from "../components/Dialog";
import { FriendCompare } from "../components/FriendCompare";
import { Divider, Eyebrow, PrimaryButton, Txt } from "../components/ui";
import { useAuth } from "../lib/auth";
import { registerForPush } from "../lib/notifications";
import { useStore } from "../lib/store";
import { TIER_COLORS, TIER_NAMES, type TierName } from "../lib/rank";
import {
  acceptRequest,
  findProfile,
  handleOk,
  loadFeed,
  loadFriends,
  myProfile,
  publishRankFromData,
  removeEdge,
  saveProfile,
  searchProfiles,
  sendRequest,
  suggestHandle,
  type Friend,
  type FriendRequest,
  type Profile,
  type RankEvent,
} from "../lib/social";

/** "3d" / "2h" / "now" — feed timestamps, short enough to sit in a row. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

/** Snapshot tiers arrive as plain strings — keep the badge total. */
function asTier(name: string): TierName {
  return (TIER_NAMES as readonly string[]).includes(name) ? (name as TierName) : "Rust";
}

function Banner({ text, tone = "bad" }: { text: string; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? C.badAcc : C.goodAcc;
  const bg = tone === "bad" ? C.badSurf : C.goodSurf;
  return (
    <PopIn>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: bg,
          borderRadius: R.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Icon name={tone === "bad" ? "TriangleAlert" : "Check"} size={15} color={color} />
        <Txt size={12.5} weight="semibold" color={color} style={{ flex: 1 }}>
          {text}
        </Txt>
      </View>
    </PopIn>
  );
}

/** Bare input row used by both the handle claim and the search field. */
function HandleInput({
  value,
  onChange,
  placeholder,
  onSubmit,
  /** Claim mode: force handle characters. Search mode must NOT, or you can
   *  never type a display name with a space in it. */
  handleOnly = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  handleOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flex: 1,
        backgroundColor: C.page2,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: focused ? C.accent : C.line,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {handleOnly ? (
        <Txt size={15} weight="bold" color={C.inkFaint}>@</Txt>
      ) : (
        <Icon name="Search" size={16} color={C.inkFaint} />
      )}
      <TextInput
        value={value}
        onChangeText={(v) =>
          onChange(handleOnly ? v.toLowerCase().replace(/[^a-z0-9_]/g, "") : v)
        }
        placeholder={placeholder}
        placeholderTextColor={C.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1, fontFamily: FONT.semibold, fontSize: 15, color: C.ink, padding: 0 }}
      />
    </View>
  );
}

export function Friends() {
  const { user, exitGuest } = useAuth();
  const { workouts, exercises, measurements, settings } = useStore();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [feed, setFeed] = useState<RankEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profile claim form.
  const [handle, setHandle] = useState("");
  // Add-friend form.
  const [search, setSearch] = useState("");
  const [unfriending, setUnfriending] = useState<Friend | null>(null);
  /** Friend opened in the head-to-head compare overlay. */
  const [comparing, setComparing] = useState<Friend | null>(null);
  /** Live search results for the current query. */
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);

  /** Republish own rank so friends never see a stale badge. */
  const publishMine = useCallback(
    () => publishRankFromData({ workouts, exercises, measurements, settings }),
    [workouts, exercises, measurements, settings],
  );

  const refresh = useCallback(async () => {
    setError(null);
    const p = await myProfile();
    if (p.error) {
      setError(p.error);
      setLoading(false);
      return;
    }
    setProfile(p.data);
    if (!p.data) {
      setHandle(suggestHandle(settings.name || ""));
      setLoading(false);
      return;
    }
    await publishMine();
    const [list, events] = await Promise.all([loadFriends(), loadFeed(12)]);
    if (list.error) setError(list.error);
    if (list.data) {
      setFriends(list.data.friends);
      setRequests(list.data.requests);
    }
    if (events.data) setFeed(events.data);
    setLoading(false);
  }, [publishMine, settings.name]);

  useEffect(() => {
    if (user) void refresh();
    else setLoading(false);
  }, [user, refresh]);

  // Ask for notification permission HERE rather than at launch: the OS
  // prompt appears once, and one shown out of context gets denied forever.
  // Someone opening Friends has just demonstrated they care about this.
  useEffect(() => {
    if (user) void registerForPush();
  }, [user]);

  // Debounced search: typing a handle fires one request after a pause, not
  // one per keystroke.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchProfiles(term);
      // Hide people already in the list — adding them again is a dead end.
      const known = new Set([...friends.map((f) => f.userId), ...requests.map((r) => r.userId)]);
      setResults((res.data ?? []).filter((p) => !known.has(p.userId)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, friends, requests]);

  const act = async (fn: () => Promise<{ error: string | null }>, ok?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fn();
    if (res.error) setError(res.error);
    else {
      if (ok) setNotice(ok);
      await refresh();
    }
    setBusy(false);
  };

  const claim = () =>
    void act(
      () => saveProfile(handle, settings.name || handle, true),
      "Profile published — friends can find you by your handle.",
    );

  /** Send a request to a specific search result. */
  const addUser = (p: Profile) =>
    void act(async () => {
      const sent = await sendRequest(p.userId);
      if (!sent.error) {
        setSearch("");
        setResults(null);
      }
      return sent;
    }, "Request sent.");

  /** Enter on the field: if the query is an exact handle, add that person. */
  const addExact = () =>
    void act(async () => {
      const found = await findProfile(search);
      if (found.error) return { error: found.error };
      if (!found.data) return { error: `No one is using @${search.trim().toLowerCase()}.` };
      const sent = await sendRequest(found.data.userId);
      if (!sent.error) {
        setSearch("");
        setResults(null);
      }
      return sent;
    }, "Request sent.");

  // ── states ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Eyebrow style={{ marginTop: 0 }}>Friends</Eyebrow>
        <Txt size={13} color={C.inkFaint}>
          Friends need an account — that's how ranks reach each other. Your
          workouts stay private either way; only your rank is shared.
        </Txt>
        <PrimaryButton label="Sign in or create an account" onPress={exitGuest} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Eyebrow style={{ marginTop: 0 }}>Claim your handle</Eyebrow>
        <Txt size={13} color={C.inkSoft}>
          Pick a handle so friends can find you. Nothing is published until
          you do, and only your rank ever leaves this phone — never your
          workouts.
        </Txt>
        <HandleInput value={handle} onChange={setHandle} placeholder="yourname" onSubmit={claim} />
        <Txt size={11} color={C.inkFaint}>
          3–20 characters: lowercase letters, numbers and _.
        </Txt>
        {error ? <Banner text={error} /> : null}
        <PrimaryButton
          label={busy ? "Publishing…" : "Publish my profile"}
          large
          disabled={!handleOk(handle) || busy}
          onPress={claim}
        />
      </View>
    );
  }

  const incoming = requests.filter((r) => r.direction === "in");
  const outgoing = requests.filter((r) => r.direction === "out");

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Who you are to other people */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 }}>
          <Icon name="UserCircle" size={16} color={C.inkFaint} />
          <Txt size={13} weight="bold" color={C.inkSoft} style={{ flex: 1 }}>
            @{profile.handle}
          </Txt>
          <Pressable
            hitSlop={8}
            onPress={() => void refresh()}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <Icon name="Repeat" size={14} color={C.inkFaint} />
            <Txt size={12} weight="bold" color={C.inkFaint}>Refresh</Txt>
          </Pressable>
        </View>

        {/* Find someone */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <HandleInput
            value={search}
            onChange={setSearch}
            placeholder="search by name or handle"
            onSubmit={addExact}
            handleOnly={false}
          />
          {searching ? (
            <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={C.accent} />
            </View>
          ) : null}
        </View>

        {/* Results */}
        {results != null ? (
          results.length === 0 ? (
            <Txt size={12.5} color={C.inkFaint} style={{ marginTop: 12 }}>
              {searching
                ? "Searching…"
                : `Nobody matches "${search.trim()}". They need a published profile to be findable.`}
            </Txt>
          ) : (
            <>
              <Eyebrow>Results ({results.length})</Eyebrow>
              {results.map((p, i) => (
                <View key={p.userId}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt size={14.5} weight="bold" numberOfLines={1}>{p.displayName}</Txt>
                      <Txt size={12} color={C.inkFaint}>@{p.handle}</Txt>
                    </View>
                    <Pressable
                      onPress={() => addUser(p)}
                      disabled={busy}
                      style={{
                        borderRadius: R.ctrl,
                        backgroundColor: busy ? C.page2 : C.accent,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                      }}
                    >
                      <Txt size={12.5} weight="extrabold" color={busy ? C.inkFaint : C.accentInk}>
                        Add
                      </Txt>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )
        ) : null}

        {error ? <View style={{ marginTop: 10 }}><Banner text={error} /></View> : null}
        {notice ? <View style={{ marginTop: 10 }}><Banner text={notice} tone="good" /></View> : null}

        {/* Requests waiting on you */}
        {incoming.length > 0 ? (
          <>
            <Eyebrow>Requests ({incoming.length})</Eyebrow>
            {incoming.map((r, i) => (
              <View key={r.edgeId}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt size={15} weight="bold" numberOfLines={1}>{r.displayName}</Txt>
                    <Txt size={12} color={C.inkFaint}>@{r.handle}</Txt>
                  </View>
                  <Pressable
                    onPress={() => void act(() => acceptRequest(r.edgeId))}
                    disabled={busy}
                    style={{
                      borderRadius: R.ctrl,
                      backgroundColor: C.accent,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Txt size={12.5} weight="extrabold" color={C.accentInk}>Accept</Txt>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => void act(() => removeEdge(r.edgeId))} disabled={busy}>
                    <Icon name="X" size={18} color={C.inkFaint} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Rank-ups — the reason to open this tab twice a week */}
        {feed.length > 0 ? (
          <>
            <Eyebrow>Rank-ups</Eyebrow>
            {feed.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
                  <RankBadge tier={asTier(e.toTier)} stage={4} size={34} />
                  <Txt size={12.5} color={C.inkSoft} style={{ flex: 1 }}>
                    <Txt size={12.5} weight="extrabold" color={e.isMe ? C.accent : C.ink}>
                      {e.isMe ? "You" : `@${e.handle}`}
                    </Txt>
                    {e.isMe ? " reached " : " reached "}
                    <Txt size={12.5} weight="extrabold" color={TIER_COLORS[asTier(e.toTier)]}>
                      {e.toTier}
                    </Txt>
                    {e.kind === "lift" && e.liftName ? ` on ${e.liftName}` : " overall"}
                  </Txt>
                  <Txt size={11} weight="bold" color={C.inkFaint}>{ago(e.createdAt)}</Txt>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Friends, strongest first */}
        <Eyebrow>Friends ({friends.length})</Eyebrow>
        {friends.length === 0 ? (
          <Txt size={13} color={C.inkFaint}>
            No friends yet — add someone by their handle and compare where you
            both stand.
          </Txt>
        ) : (
          friends.map((f, i) => {
            const s = f.snapshot;
            const top = s?.lifts?.[0];
            return (
              <View key={f.edgeId}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setComparing(f)}
                  onLongPress={() => setUnfriending(f)}
                  delayLongPress={400}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
                >
                  <Avatar uri={f.avatarUrl} name={f.displayName} size={38} />
                  <RankBadge tier={asTier(s?.tier ?? "Rust")} stage={s?.stage ?? 1} size={58} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt size={15} weight="bold" numberOfLines={1}>{f.displayName}</Txt>
                    <Txt size={12} color={C.inkSoft} numberOfLines={1}>
                      @{f.handle}
                      {s ? ` · ${s.tier}` : " · no rank yet"}
                    </Txt>
                    {top ? (
                      <Txt size={11} color={C.inkFaint} numberOfLines={1}>
                        Best: {top.name} {top.e1RM} {top.unit}
                      </Txt>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 1 }}>
                    <Txt size={16} weight="extrabold" color={s ? TIER_COLORS[asTier(s.tier)] : C.inkFaint}>
                      {s ? Math.round(s.points) : "—"}
                    </Txt>
                    <Txt size={9} weight="bold" color={C.inkFaint}>PTS</Txt>
                  </View>
                  <Icon name="ChevronRight" size={16} color={C.inkFaint} />
                </Pressable>
              </View>
            );
          })
        )}
        {friends.length > 0 ? (
          <Txt size={10} color={C.inkFaint} style={{ marginTop: 4 }}>
            Tap a friend to compare lift by lift, hold to remove them. Only
            ranks are shared — never your workout logs.
          </Txt>
        ) : null}

        {/* Requests you sent */}
        {outgoing.length > 0 ? (
          <>
            <Eyebrow>Sent ({outgoing.length})</Eyebrow>
            {outgoing.map((r, i) => (
              <View key={r.edgeId}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={13} weight="semibold" color={C.inkSoft}>@{r.handle}</Txt>
                  </View>
                  <Txt size={11} weight="bold" color={C.inkFaint}>Waiting</Txt>
                  <Pressable hitSlop={8} onPress={() => void act(() => removeEdge(r.edgeId))} disabled={busy}>
                    <Icon name="X" size={16} color={C.inkFaint} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

      </KeyboardAwareScrollView>

      {comparing ? (
        <FriendCompare friend={comparing} onClose={() => setComparing(null)} />
      ) : null}

      {unfriending ? (
        <ConfirmDialog
          title="Remove friend?"
          message={`@${unfriending.handle} will no longer see your rank, and you won't see theirs.`}
          onConfirm={() => {
            const id = unfriending.edgeId;
            setUnfriending(null);
            void act(() => removeEdge(id));
          }}
          onClose={() => setUnfriending(null)}
        />
      ) : null}
    </View>
  );
}
