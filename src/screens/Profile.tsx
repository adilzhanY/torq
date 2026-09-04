/**
 * Profile: the ATHLETE CARD (idea 1 of the lavish profile review,
 * `.lavish/torq-profile.html`; Adilzhan picked "1 with a settings page built
 * like 2", 2026-08-09).
 *
 * It used to be four screens in one scroll, identity, a full rank card, the
 * app's settings, and account deletion, about 2 400 px of it. Now the page
 * has exactly one job, "who am I here":
 *
 *  - avatar, name, @handle, body line, and how long you have been lifting;
 *  - a rank STRIP that summarises and links to the Ranks tab, rather than
 *    repeating the 168 px shield that tab already shows;
 *  - three lifetime numbers, and the best lifts with their percentiles;
 *  - Share, wired to the card component that already existed and had no
 *    button anywhere near this page.
 *
 * Everything adjustable moved to src/screens/Settings.tsx, one tap away
 * behind the gear.
 */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { SlideUp } from "../components/anim";
import { Avatar } from "../components/Avatar";
import { BADGE_ROW, RankBadge } from "../components/RankBadge";
import { CustomModal } from "../components/CustomModal";
import { ShareRankCard } from "../components/ShareCard";
import { Paywall } from "../components/Paywall";
import { Divider, Eyebrow, PageTitle, PrimaryButton, TextField, Txt } from "../components/ui";
import { Settings } from "./Settings";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import { can, type Feature } from "../lib/entitlements";
import { avatarSource, pickAvatar, removeAvatar, uploadAvatar } from "../lib/avatar";
import { loadFriends, myProfile } from "../lib/social";
import { bodyProfileAt } from "../lib/calories";
import { computeStreak } from "../lib/streak";
import {
  percentileForExercise,
  percentileLabel,
  percentileLabelQualified,
} from "../lib/percentile";
import { overallRank, rankLifts, stageOf, tierLabel, TIER_COLORS } from "../lib/rank";
import { workoutVolume } from "../types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 412350 → "412k". Lifetime volume is a brag, not an audit. */
function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt size={24} weight="extrabold">{value}</Txt>
      <Txt size={10} weight="bold" color={C.inkFaint}>{label}</Txt>
    </View>
  );
}

/** A tappable row in the short "quick links" list at the bottom. */
function LinkRow({
  icon,
  title,
  value,
  onPress,
  color,
}: {
  icon: string;
  title: string;
  value: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: R.ctrl,
            backgroundColor: C.page2,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={17} color={color ?? C.ink} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Txt size={14} weight="semibold">{title}</Txt>
          <Txt size={11.5} color={C.inkFaint} numberOfLines={1}>{value}</Txt>
        </View>
        <Icon name="ChevronRight" size={17} color={C.inkFaint} />
      </View>
    </Pressable>
  );
}

/** Name + photo: the only two things about you that are edited here. */
function EditDialog({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const uri = avatarSource(settings);

  const choose = async () => {
    setBusy(true);
    setNote(null);
    const picked = await pickAvatar();
    if (picked.error) {
      setBusy(false);
      setNote(picked.error);
      return;
    }
    if (!picked.uri) {
      setBusy(false);
      return;
    }
    // Show it immediately; the upload is what can be slow or fail.
    updateSettings({ avatarUri: picked.uri, avatarUrl: undefined });
    const up = await uploadAvatar(picked.uri);
    if (up.url) updateSettings({ avatarUrl: up.url });
    else if (up.error) setNote(`Saved on this phone, but not uploaded: ${up.error}`);
    setBusy(false);
  };

  const clear = async () => {
    setBusy(true);
    setNote(null);
    updateSettings({ avatarUri: undefined, avatarUrl: undefined });
    await removeAvatar();
    setBusy(false);
  };

  return (
    <CustomModal onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Txt size={18} weight="extrabold">Edit profile</Txt>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={() => void choose()} disabled={busy}>
            <Avatar uri={uri} name={settings.name} size={64} />
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: C.accent,
                borderWidth: 2,
                borderColor: C.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="Camera" size={13} color={C.accentInk} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <Pressable onPress={() => void choose()} disabled={busy} hitSlop={6}>
              <Txt size={13} weight="bold" color={C.accent}>
                {busy ? "Working…" : uri ? "Change photo" : "Add a photo"}
              </Txt>
            </Pressable>
            {uri ? (
              <Pressable onPress={() => void clear()} disabled={busy} hitSlop={6}>
                <Txt size={13} weight="bold" color={C.inkFaint}>Remove photo</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Txt size={12} weight="bold" color={C.inkSoft}>Your name</Txt>
          <TextField
            value={settings.name}
            onChange={(name) => updateSettings({ name })}
            placeholder="Name"
          />
        </View>

        {note ? <Txt size={11} color={C.warnAcc}>{note}</Txt> : null}
        <PrimaryButton label="Done" onPress={onClose} />
      </View>
    </CustomModal>
  );
}

export function Profile({
  onClose,
  onRebuildPlan,
}: {
  onClose: () => void;
  /** Reopens the onboarding wizard to regenerate the training plan. */
  onRebuildPlan: () => void;
}) {
  const { workouts, exercises, measurements, routines, settings } = useStore();
  const { openRanks } = useUi();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [paywall, setPaywall] = useState<Feature | null>(null);
  /** Public identity, when there is an account with a claimed handle. */
  const [handle, setHandle] = useState<string | null>(null);
  const [circle, setCircle] = useState<{ friends: number; requests: number } | null>(null);

  useEffect(() => {
    const h = BackHandler.addEventListener("hardwareBackPress", () => {
      // Overlays install their own handlers and answer first.
      if (settingsOpen || editing || sharing || paywall) return false;
      onClose();
      return true;
    });
    return () => h.remove();
  }, [onClose, settingsOpen, editing, sharing, paywall]);

  // Public identity is a nice-to-have: signed out, offline, and "no handle
  // claimed yet" are all normal, so failures are silent and the page simply
  // renders without them.
  useEffect(() => {
    let alive = true;
    void myProfile().then((res) => {
      if (alive && res.data) setHandle(res.data.handle);
    });
    void loadFriends().then((res) => {
      if (!alive || !res.data) return;
      setCircle({
        friends: res.data.friends.length,
        requests: res.data.requests.filter((r) => r.direction === "in").length,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const body = bodyProfileAt(settings, measurements, Date.now());
  const lifts = rankLifts(workouts, settings.unit, body.weightKg, body.sex);
  const overall = overallRank(lifts);
  const s = overall.state;
  const streak = computeStreak(workouts, routines, Date.now());
  const displayName = settings.name?.trim() || "Athlete";
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const totalVolume = workouts.reduce((sum, w) => sum + workoutVolume(w), 0);
  const ranked = lifts.length > 0;
  const photo = avatarSource(settings);

  /** "lifting since Jul 2026": derived from the first logged session rather
   *  than stored, so it stays true for someone who imported their history. */
  const since = (() => {
    const first = workouts.reduce(
      (min, w) => (w.startedAt < min ? w.startedAt : min),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(first)) return null;
    const d = new Date(first);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  })();

  /** Percentile line for the competition lifts; the rest have no curve. */
  const pctOf = (exerciseId: string, points: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return null;
    const p = percentileForExercise(ex.name, ex.equipment, body.sex, points);
    return p ? percentileLabelQualified(p) : null;
  };

  /** Strongest percentile across the ranked lifts: the share card's line. */
  const bestPercentile = (() => {
    let best: { text: string; lift: string; pct: number } | null = null;
    for (const l of lifts) {
      const ex = exercises.find((e) => e.id === l.exerciseId);
      if (!ex) continue;
      const p = percentileForExercise(ex.name, ex.equipment, body.sex, l.points);
      if (p && (!best || p.percent > best.pct))
        best = { text: percentileLabel(p), lift: ex.name, pct: p.percent };
    }
    return best ? { text: best.text, lift: best.lift } : undefined;
  })();

  return (
    <SlideUp
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.page,
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <PageTitle style={{ flex: 1 }}>Profile</PageTitle>
          <Pressable hitSlop={8} onPress={() => setSettingsOpen(true)}>
            <Icon name="SlidersVertical" size={21} color={C.inkSoft} />
          </Pressable>
        </View>

        {/* Identity */}
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <Pressable onPress={() => setEditing(true)}>
            {/* Lime RING, but only around a PHOTO. The no-picture avatar is
                already a lime disc, so ringing it in the same lime turned the
                whole thing into one blob on the device. */}
            <View
              style={
                photo
                  ? { padding: 3, borderRadius: R.pill, backgroundColor: C.accent }
                  : undefined
              }
            >
              <Avatar uri={photo} name={displayName} size={96} />
            </View>
          </Pressable>
          <Txt size={24} weight="extrabold" style={{ marginTop: 12 }} numberOfLines={1}>
            {displayName}
          </Txt>
          {handle ? (
            <Txt size={13} weight="semibold" color={C.accent}>@{handle}</Txt>
          ) : null}
          <Txt size={11.5} color={C.inkFaint} style={{ marginTop: 3 }}>
            {Math.round(body.weightKg)} kg · {body.sex === "male" ? "M" : "F"}
            {since ? ` · lifting since ${since}` : ""}
          </Txt>
        </View>

        {/* Rank STRIP, a summary that links to the Ranks tab, not a copy of
            it. That tab already renders the big shield. */}
        {ranked ? (
          <Pressable
            onPress={() => {
              onClose();
              openRanks("you");
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 18,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: R.md,
              padding: 12,
            }}
          >
            <RankBadge tier={s.tier} stage={stageOf(s.progress)} size={BADGE_ROW} />
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
                <Txt size={20} weight="extrabold">{Math.round(s.points)}</Txt>
                <Txt size={11} weight="extrabold" color={C.accent}>pts</Txt>
                <Txt
                  size={12}
                  weight="extrabold"
                  color={TIER_COLORS[s.tier]}
                  style={{ marginLeft: "auto" }}
                >
                  {tierLabel(s)}
                </Txt>
              </View>
              <View
                style={{
                  height: 6,
                  borderRadius: R.pill,
                  backgroundColor: C.page2,
                  overflow: "hidden",
                  marginTop: 6,
                }}
              >
                <View
                  style={{
                    width: `${Math.round(s.progress * 100)}%`,
                    height: "100%",
                    borderRadius: R.pill,
                    backgroundColor: C.accent,
                  }}
                />
              </View>
              <Txt size={11} color={C.inkFaint} style={{ marginTop: 5 }}>
                {s.next ? `${Math.ceil(s.toNext)} pts to ${s.next}` : "Top of the ladder"}
              </Txt>
            </View>
            <Icon name="ChevronRight" size={17} color={C.inkFaint} />
          </Pressable>
        ) : (
          <Txt size={13} color={C.inkFaint} style={{ marginTop: 18 }}>
            Finish a workout with weighted sets (10 reps or fewer) and your
            rank appears here.
          </Txt>
        )}

        {/* Three lifetime numbers */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <Stat label="WORKOUTS" value={String(workouts.length)} />
          <Stat label={`VOLUME ${settings.unit.toUpperCase()}`} value={short(totalVolume)} />
          <Stat label="DAY STREAK" value={String(streak.current)} />
        </View>

        {/* Best lifts, the top 3 the overall score counts */}
        {ranked ? (
          <>
            <Eyebrow>Best lifts</Eyebrow>
            <View>
              {overall.counted.map((l, i) => {
                const pct = pctOf(l.exerciseId, l.points);
                return (
                  <View key={l.exerciseId}>
                    {i > 0 ? <Divider /> : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <RankBadge tier={l.tier.tier} stage={stageOf(l.tier.progress)} size={BADGE_ROW} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Txt size={14} weight="semibold" numberOfLines={1}>
                          {exName(l.exerciseId)}
                        </Txt>
                        <Txt size={11.5} weight="bold" color={TIER_COLORS[l.tier.tier]}>
                          {tierLabel(l.tier)}
                          {pct ? <Txt size={11.5} color={C.inkSoft}> · {pct}</Txt> : null}
                        </Txt>
                      </View>
                      <Txt size={15} weight="extrabold" style={{ minWidth: 44, textAlign: "right" }}>
                        {l.e1RM}
                      </Txt>
                    </View>
                  </View>
                );
              })}
            </View>
            <Txt size={10} color={C.inkFaint} style={{ marginTop: 2 }}>
              Best estimated 1RM ({settings.unit}) · DOTS-normalized to your body · warmups and 10+ rep sets excluded
            </Txt>
          </>
        ) : null}

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
          {ranked ? (
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Share card"
                onPress={() => (can("shareCards") ? setSharing(true) : setPaywall("shareCards"))}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Edit profile"
              background={C.page2}
              color={C.ink}
              onPress={() => setEditing(true)}
            />
          </View>
        </View>

        <Eyebrow>Quick links</Eyebrow>
        <LinkRow
          icon="UserCircle"
          title="Friends"
          value={
            circle
              ? `${circle.friends} friend${circle.friends === 1 ? "" : "s"}` +
                (circle.requests > 0
                  ? ` · ${circle.requests} request${circle.requests === 1 ? "" : "s"}`
                  : "")
              : "Compare where you both stand"
          }
          color={C.accent}
          onPress={() => {
            onClose();
            openRanks("friends");
          }}
        />
        <Divider />
        <LinkRow
          icon="CalendarDays"
          title="Training plan"
          value={settings.plan ? `${settings.plan.weekdays?.length ?? 0} days a week` : "No plan yet"}
          onPress={onRebuildPlan}
        />
        <Divider />
        <LinkRow
          icon="SlidersVertical"
          title="Settings"
          value="Units, sound, body profile, account, data"
          onPress={() => setSettingsOpen(true)}
        />
      </ScrollView>

      {editing ? <EditDialog onClose={() => setEditing(false)} /> : null}

      {sharing ? (
        <ShareRankCard
          state={s}
          stage={stageOf(s.progress)}
          displayName={displayName}
          handle={handle ?? undefined}
          bodyweightKg={body.weightKg}
          sex={body.sex}
          lifts={overall.counted.map((l) => ({
            name: exName(l.exerciseId),
            e1RM: l.e1RM,
            unit: settings.unit,
          }))}
          percentile={bestPercentile}
          onClose={() => setSharing(false)}
        />
      ) : null}

      {paywall ? <Paywall feature={paywall} onClose={() => setPaywall(null)} /> : null}

      {settingsOpen ? (
        <Settings onClose={() => setSettingsOpen(false)} onRebuildPlan={onRebuildPlan} />
      ) : null}
    </SlideUp>
  );
}
