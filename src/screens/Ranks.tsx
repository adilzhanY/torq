/**
 * Ranks tab (PATH.md Phase 1, from the approved brand-v2 mockup): the
 * overall score up top, then every ranked lift as a row with its shield
 * badge. Cardless — type, hairlines, and the badges do the work. Points
 * and tiers only; percentile lines arrive with the bundled dataset.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE } from "../theme";
import { Divider, Eyebrow, Txt } from "../components/ui";
import { Icon } from "../components/Icon";
import { RankBadge } from "../components/RankBadge";
import { ExerciseInfo } from "../components/ExerciseInfo";
import { ShareRankCard } from "../components/ShareCard";
import { Friends } from "./Friends";
import { Logo } from "../components/Logo";
import { DB_GIF_BY_ID } from "../lib/exercisedb";
import { bodyProfileAt } from "../lib/calories";
import { overallRank, rankLifts, stageOf, tierLabel } from "../lib/rank";
import { percentileForExercise, percentileLabel } from "../lib/percentile";
import { useStore } from "../lib/store";

export function Ranks() {
  const { workouts, exercises, measurements, settings } = useStore();
  /** Library id of the lift opened as a full rank page. */
  const [info, setInfo] = useState<string | null>(null);
  /** You (own ladder) vs Friends (the circle's ranks). */
  const [view, setView] = useState<"you" | "friends">("you");
  /** Share-card overlay (the rank as a story image). */
  const [sharing, setSharing] = useState(false);
  const profile = bodyProfileAt(settings, measurements, Date.now());
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
      <Logo size={30} />
      <Txt size={26} weight="extrabold" style={{ flex: 1 }}>Ranks</Txt>
      <Txt size={13} color={C.inkSoft}>
        {Math.round(profile.weightKg)} kg · {profile.sex === "male" ? "M" : "F"}
      </Txt>
      {lifts.length > 0 ? (
        <Pressable
          hitSlop={8}
          onPress={() => setSharing(true)}
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
      {view === "friends" ? (
        // Friends owns its own scroll root so its overlays (compare,
        // confirm) can position against the WINDOW, not scroll content.
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: TOP_BAR_SPACE + 16 }}>{head}</View>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <Friends />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120 }}
        >
          {head}
        {lifts.length === 0 ? (
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <RankBadge tier={s.tier} stage={stageOf(s.progress)} size={64} />
              <View style={{ flex: 1, gap: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
                  <Txt size={32} weight="extrabold" color={C.accent}>{Math.round(s.points)}</Txt>
                  <Txt size={13} weight="extrabold" color={C.accent}>pts</Txt>
                </View>
                <Txt size={12.5} color={C.inkSoft}>
                  {tierLabel(s)}
                  {s.next ? ` · ${Math.ceil(s.toNext)} pts to ${s.next}` : " · top of the ladder"}
                </Txt>
              </View>
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
                    <RankBadge tier={l.tier.tier} stage={stageOf(l.tier.progress)} size={48} />
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
