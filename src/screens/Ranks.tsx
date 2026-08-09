/**
 * Ranks tab (PATH.md Phase 1, from the approved brand-v2 mockup): the
 * overall score up top, then every ranked lift as a row with its shield
 * badge. Cardless — type, hairlines, and the badges do the work. Points
 * and tiers only; percentile lines arrive with the bundled dataset.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE } from "../theme";
import { Divider, Eyebrow, PageTitle, Txt } from "../components/ui";
import { Icon } from "../components/Icon";
import { RankBadge } from "../components/RankBadge";
import { TierCarousel } from "../components/TierCarousel";
import { ExerciseInfo } from "../components/ExerciseInfo";
import { ShareRankCard } from "../components/ShareCard";
import { LockedPanel, Paywall } from "../components/Paywall";
import { can, type Feature } from "../lib/entitlements";
import { Arena } from "./Arena";
import { Friends } from "./Friends";
import { DB_GIF_BY_ID } from "../lib/exercisedb";
import { bodyProfileAt } from "../lib/calories";
import { overallRank, rankLifts, stageOf, tierLabel } from "../lib/rank";
import { percentileForExercise, percentileLabel } from "../lib/percentile";
import { useStore } from "../lib/store";
import { tierDates } from "../lib/progress";
import { useUi } from "../lib/ui";

export function Ranks() {
  const { workouts, exercises, measurements, settings } = useStore();
  /** Library id of the lift opened as a full rank page. */
  const [info, setInfo] = useState<string | null>(null);
  /** You (own ladder) vs Friends (the circle's ranks) vs the Arena. Held in
   *  the UI context so Profile can deep-link straight to a segment. */
  const { ranksView: view, setRanksView: setView } = useUi();
  /** Share-card overlay (the rank as a story image). */
  const [sharing, setSharing] = useState(false);
  /** Paid surface the user reached for, if it is locked. */
  const [paywall, setPaywall] = useState<Feature | null>(null);
  const profile = bodyProfileAt(settings, measurements, Date.now());
  const finishedWorkouts = useMemo(() => workouts.filter((w) => w.endedAt), [workouts]);
  /** Bodyweight AT A DATE — DOTS divides by it, so the tier a session earned
   *  has to be scored with the body you had that day. */
  const bodyAt = useMemo(
    () => (ms: number) => {
      const p = bodyProfileAt(settings, measurements, ms);
      return { weightKg: p.weightKg, sex: p.sex };
    },
    [settings, measurements],
  );
  const lifts = rankLifts(workouts, settings.unit, profile.weightKg, profile.sex);
  const overall = overallRank(lifts);
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  /** Percentile line for the three competition lifts; null for the rest. */
  const pctOf = (exerciseId: string, points: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return null;
    const p = percentileForExercise(ex.name, ex.equipment, profile.sex, points);
    return p ? percentileLabel(p) : null;
  };
  const s = overall.state;

  const opened = info ? exercises.find((e) => e.id === info) : undefined;

  /** Strongest percentile across the ranked competition lifts — the single
   *  line most worth putting on a share card. */
  const bestPercentile = (() => {
    let best: { text: string; lift: string; pct: number } | null = null;
    for (const l of lifts) {
      const ex = exercises.find((e) => e.id === l.exerciseId);
      if (!ex) continue;
      const p = percentileForExercise(ex.name, ex.equipment, profile.sex, l.points);
      if (p && (!best || p.percent > best.pct))
        best = { text: percentileLabel(p), lift: ex.name, pct: p.percent };
    }
    return best ? { text: best.text, lift: best.lift } : undefined;
  })();

  /** Title row + the You/Friends switch, shared by both views. */
  const head = (
    <>
    {/* Header: mark + title + body class */}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <PageTitle style={{ flex: 1 }}>Ranks</PageTitle>
      <Txt size={13} color={C.inkSoft}>
        {Math.round(profile.weightKg)} kg · {profile.sex === "male" ? "M" : "F"}
      </Txt>
      {lifts.length > 0 ? (
        <Pressable
          hitSlop={8}
          onPress={() => (can("shareCards") ? setSharing(true) : setPaywall("shareCards"))}
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
          <Icon name="Share2" size={16} color={C.ink} />
        </Pressable>
      ) : null}
    </View>

    {/* You / Friends */}
    <View
      style={{
        flexDirection: "row",
        backgroundColor: C.page2,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: C.line,
        padding: 4,
        gap: 4,
        marginTop: 14,
      }}
    >
      {([["you", "You"], ["friends", "Friends"]] as const).map(([v, label]) => (
        <Pressable
          key={v}
          onPress={() => setView(v)}
          style={{
            flex: 1,
            borderRadius: R.sm,
            paddingVertical: 9,
            alignItems: "center",
            backgroundColor: view === v ? C.accent : "transparent",
          }}
        >
          <Txt size={13} weight="bold" color={view === v ? C.accentInk : C.inkSoft}>
            {label}
          </Txt>
        </Pressable>
      ))}
    </View>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      {view !== "you" ? (
        // Friends/Arena own their scroll roots so their overlays (compare,
        // confirm) position against the WINDOW, not scroll content.
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: TOP_BAR_SPACE + 16 }}>{head}</View>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {view === "friends" ? (
              can("friends") ? (
                <Friends />
              ) : (
                <LockedPanel feature="friends" onUnlock={() => setPaywall("friends")} />
              )
            ) : can("arena") ? (
              <Arena />
            ) : (
              <LockedPanel feature="arena" onUnlock={() => setPaywall("arena")} />
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120 }}
        >
          {head}
        {!can("ranks") ? (
          <LockedPanel feature="ranks" onUnlock={() => setPaywall("ranks")} />
        ) : lifts.length === 0 ? (
          <View>
            <Eyebrow>Overall</Eyebrow>
            <Txt size={13} color={C.inkFaint}>
              Finish a workout with weighted sets (10 reps or fewer) and your
              ranks appear here — every lift gets a tier, normalized to your
              body.
            </Txt>
          </View>
        ) : (
          <>
            {/* Overall */}
            <Eyebrow>Overall</Eyebrow>
            {/* The ladder IS the hero: it opens centred on your own tier at
                full size, and swiping walks the whole ladder — earned tiers
                with the date you got them, locked ones with what they cost.
                The full-bleed negative margin lets neighbours run to the
                screen edges instead of stopping at the page gutter. */}
            <View style={{ marginHorizontal: -16, marginTop: -4 }}>
              <TierCarousel state={s} dates={tierDates(finishedWorkouts, settings.unit, bodyAt)} />
            </View>

            <View style={{ alignItems: "center", gap: 2, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Txt size={44} weight="extrabold" color={C.accent}>{Math.round(s.points)}</Txt>
                <Txt size={16} weight="extrabold" color={C.accent}>pts</Txt>
              </View>
              <Txt size={13.5} color={C.inkSoft}>{tierLabel(s)}</Txt>
            </View>
            <View
              style={{
                height: 5,
                borderRadius: 99,
                backgroundColor: C.page2,
                marginTop: 12,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.round(s.progress * 100)}%`,
                  height: "100%",
                  borderRadius: 99,
                  backgroundColor: C.accent,
                }}
              />
            </View>

            {/* Every ranked lift */}
            <Eyebrow>Lifts ({lifts.length})</Eyebrow>
            <View>
              {lifts.map((l, i) => (
                <View key={l.exerciseId}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => setInfo(l.exerciseId)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}
                  >
                    <RankBadge tier={l.tier.tier} stage={stageOf(l.tier.progress)} size={62} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt size={15} weight="bold" numberOfLines={1}>{name(l.exerciseId)}</Txt>
                      <Txt size={12} color={C.inkSoft}>
                        {l.e1RM} {settings.unit} e1RM · {tierLabel(l.tier)}
                      </Txt>
                      {(() => {
                        const p = pctOf(l.exerciseId, l.points);
                        return p ? (
                          <Txt size={11} weight="bold" color={C.accent}>{p}</Txt>
                        ) : null;
                      })()}
                    </View>
                    <Txt size={14} weight="extrabold" color={C.inkSoft}>
                      {Math.round(l.points)}
                    </Txt>
                    <Icon name="ChevronRight" size={16} color={C.inkFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Txt size={10} color={C.inkFaint} style={{ marginTop: 6 }}>
              DOTS points, normalized to your sex and bodyweight · best
              estimated 1RM from sets of 10 reps or fewer, warmups excluded
            </Txt>
          </>
        )}
        </ScrollView>
      )}


      {paywall ? <Paywall feature={paywall} onClose={() => setPaywall(null)} /> : null}

      {sharing ? (
        <ShareRankCard
          state={s}
          stage={stageOf(s.progress)}
          displayName={settings.name?.trim() || "Athlete"}
          bodyweightKg={profile.weightKg}
          sex={profile.sex}
          lifts={lifts.slice(0, 3).map((l) => ({
            name: name(l.exerciseId),
            e1RM: l.e1RM,
            unit: settings.unit,
          }))}
          percentile={bestPercentile}
          onClose={() => setSharing(false)}
        />
      ) : null}

      {opened ? (
        <ExerciseInfo
          exercise={{
            libId: opened.id,
            dbId: opened.dbId,
            name: opened.name,
            bodyPart: opened.bodyPart,
            equipment: opened.equipment,
            gifUrl: opened.dbId ? DB_GIF_BY_ID[opened.dbId] : undefined,
          }}
          initialTab="rank"
          onClose={() => setInfo(null)}
        />
      ) : null}
    </View>
  );
}
