/**
 * The Arena (PATH.md Phase 4): the global leaderboard, behind the third
 * segment of the Ranks tab.
 *
 * Built to be honest about its own trustworthiness. An anonymous global
 * board is the single easiest surface in the app to poison, so:
 *  - appearing on it is a SEPARATE opt-in from having a public profile,
 *    friends-first stays the default, and nobody is entered silently;
 *  - a "Verified only" filter is present from day one, so trust can be
 *    tightened without retrofitting;
 *  - the footer says plainly that entries are self-reported.
 *
 * Ranking is on DOTS points, so a global board across every bodyweight is
 * still a fair comparison, which is the only reason one is defensible here
 * at all.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { Divider, Eyebrow, PrimaryButton, Txt } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { TIER_COLORS, TIER_NAMES, type TierName } from "../lib/rank";
import {
  arenaMyRank,
  arenaTop,
  myProfile,
  setArenaOptIn,
  type ArenaRow,
  type ArenaStanding,
  type Profile,
} from "../lib/social";

function asTier(name: string): TierName {
  return (TIER_NAMES as readonly string[]).includes(name) ? (name as TierName) : "Rust";
}

/** The three lifts with a real distribution behind them, plus overall. */
const BOARDS: { key: string | null; label: string }[] = [
  { key: null, label: "Overall" },
  { key: "Barbell Squat", label: "Squat" },
  { key: "Barbell Bench Press", label: "Bench" },
  { key: "Barbell Deadlift", label: "Deadlift" },
];

function medalColor(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return "#C9D2DA";
  if (rank === 3) return "#C77E4F";
  return C.inkFaint;
}

export function Arena() {
  const { user, exitGuest } = useAuth();
  const { exercises } = useStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [board, setBoard] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [rows, setRows] = useState<ArenaRow[]>([]);
  const [standing, setStanding] = useState<ArenaStanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Per-lift boards match on NAME, so offer the user's own naming too. */
  const liftName = useCallback(
    (canonical: string) => {
      const mine = exercises.find((e) => e.name.toLowerCase() === canonical.toLowerCase());
      return mine?.name ?? canonical;
    },
    [exercises],
  );

  const load = useCallback(async () => {
    setError(null);
    const p = await myProfile();
    if (p.error) {
      setError(p.error);
      setLoading(false);
      return;
    }
    setProfile(p.data);
    const key = board ? liftName(board) : null;
    const [top, mine] = await Promise.all([arenaTop(key, verifiedOnly, 50), arenaMyRank(key)]);
    if (top.error) setError(top.error);
    setRows(top.data ?? []);
    setStanding(mine.data ?? null);
    setLoading(false);
  }, [board, verifiedOnly, liftName]);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const toggleOptIn = async () => {
    setBusy(true);
    const res = await setArenaOptIn(!profile?.arena);
    if (res.error) setError(res.error);
    await load();
    setBusy(false);
  };

  if (!user) {
    return (
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Eyebrow style={{ marginTop: 0 }}>Arena</Eyebrow>
        <Txt size={13} color={C.inkFaint}>
          The global board needs an account, it ranks published snapshots,
          and without one there is nothing to publish.
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
        <Eyebrow style={{ marginTop: 0 }}>Arena</Eyebrow>
        <Txt size={13} color={C.inkSoft}>
          Claim a handle on the Friends tab first: the board shows handles,
          not names.
        </Txt>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Board picker */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 12 }}>
          {BOARDS.map((b) => {
            const active = b.key === board;
            return (
              <Pressable
                key={b.label}
                onPress={() => {
                  setBoard(b.key);
                  setLoading(true);
                }}
                style={{
                  backgroundColor: active ? C.accent : C.page2,
                  borderRadius: R.sm,
                  borderWidth: 1,
                  borderColor: active ? C.accent : C.line,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
              >
                <Txt size={12.5} weight="bold" color={active ? C.accentInk : C.inkSoft}>
                  {b.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {/* Verified filter, present from day one so trust can tighten later */}
        <Pressable
          onPress={() => {
            setVerifiedOnly((v) => !v);
            setLoading(true);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: verifiedOnly ? C.accent : C.line,
              backgroundColor: verifiedOnly ? C.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {verifiedOnly ? <Icon name="Check" size={12} color={C.accentInk} /> : null}
          </View>
          <Txt size={12.5} weight="bold" color={C.inkSoft}>
            Verified lifters only
          </Txt>
        </Pressable>

        {error ? (
          <Txt size={12.5} weight="semibold" color={C.badAcc} style={{ marginTop: 12 }}>
            {error}
          </Txt>
        ) : null}

        {/* Opt-in state */}
        {!profile.arena ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: C.page2,
              borderRadius: R.sm,
              borderWidth: 1,
              borderColor: C.line,
              padding: 14,
              gap: 10,
            }}
          >
            <Txt size={13} weight="bold">You're not on the board</Txt>
            <Txt size={12} color={C.inkSoft}>
              Joining shows your handle, your points and your tier to everyone
              using torq. Your workouts, bodyweight and friends stay private,
              and you can leave at any time.
            </Txt>
            <PrimaryButton
              label={busy ? "Joining…" : "Join the Arena"}
              disabled={busy}
              onPress={() => void toggleOptIn()}
            />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              {standing ? (
                <Txt size={13} weight="bold">
                  You're #{standing.rank}{" "}
                  <Txt size={13} color={C.inkSoft}>of {standing.total}</Txt>
                </Txt>
              ) : (
                <Txt size={12.5} color={C.inkSoft}>
                  No ranked lift on this board yet.
                </Txt>
              )}
            </View>
            <Pressable hitSlop={8} onPress={() => void toggleOptIn()} disabled={busy}>
              <Txt size={12} weight="bold" color={C.inkFaint}>Leave</Txt>
            </Pressable>
          </View>
        )}

        <Eyebrow>Top {rows.length}</Eyebrow>
        {rows.length === 0 ? (
          <Txt size={13} color={C.inkFaint}>
            {verifiedOnly
              ? "No verified lifters on this board yet, verification isn't live."
              : "Nobody has joined this board yet. Be first."}
          </Txt>
        ) : (
          rows.map((r, i) => (
            <View key={`${r.handle}-${r.rank}`}>
              {i > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  // Your own row stands out in a long list.
                  backgroundColor: r.isMe ? "rgba(200,254,35,0.08)" : "transparent",
                  marginHorizontal: -8,
                  paddingHorizontal: 8,
                  borderRadius: R.sm,
                }}
              >
                <Txt
                  size={15}
                  weight="extrabold"
                  color={medalColor(r.rank)}
                  style={{ width: 34, textAlign: "center" }}
                >
                  {r.rank}
                </Txt>
                <View style={{ flex: 1, gap: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Txt size={14.5} weight="bold" numberOfLines={1}>
                      {r.displayName}
                    </Txt>
                    {r.verified ? <Icon name="Check" size={13} color={C.goodAcc} /> : null}
                  </View>
                  <Txt size={11.5} color={C.inkFaint}>@{r.handle}</Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 1 }}>
                  <Txt size={15} weight="extrabold" color={TIER_COLORS[asTier(r.tier)]}>
                    {Math.round(r.points)}
                  </Txt>
                  <Txt size={9} weight="bold" color={C.inkFaint}>PTS</Txt>
                </View>
              </View>
            </View>
          ))
        )}

        <Txt size={10} color={C.inkFaint} style={{ marginTop: 10 }}>
          Ranked on DOTS points, so every bodyweight competes on equal terms.
          Entries are self-reported: torq drops anything above the world
          record for that lifter's class, but nothing here is proof. Treat the
          friends board as the honest one.
        </Txt>
      </ScrollView>
    </View>
  );
}
