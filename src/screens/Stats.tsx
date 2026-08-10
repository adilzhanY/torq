/**
 * Stats: "the climb" (Adilzhan picked idea 1 plus the dumbbell chart from
 * idea 2 in the lavish review `.lavish/torq-stats.html`, 2026-08-09).
 *
 * The page used to measure VOLUME: the KPI row led with "29k VOLUME (KG)"
 * and the largest chart was weekly volume, above a second, near-identical
 * bar chart of weekly workout counts, four of whose six slots were empty.
 * Volume is how much work you did; it rewards long sessions, not strong
 * ones. This page now answers the only question torq is uniquely able to
 * answer (**am I getting stronger**) in one order:
 *
 *   1. rank points now, and the climb, with the tier ladder behind it
 *   2. how far to the next tier, in points AND in kilos
 *   3. WHICH LIFTS MOVED, the dumbbell chart, where a flat row is a stall
 *   4. the records that got you here
 *   5. bodyweight (it divides DOTS, so it moves the rank) and consistency
 *
 * Volume, sets, hours, the weekly bars and the muscle split are not deleted
 *. They moved to the "Training load" sub-page, for when you actually want
 * them. Measurements moved to their own sub-page too.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE } from "../theme";
import { Icon } from "../components/Icon";
import { SubPage } from "../components/SubPage";
import { Divider, Eyebrow, NumberField, PageTitle, Pill, PrimaryButton, Txt } from "../components/ui";
import { Sparkline, fmtShort } from "../components/charts";
import { MuscleBreakdown, ProBars } from "../components/ProCharts";
import { Dumbbell, Meter, RankLine } from "../components/ProgressCharts";
import { ConfirmModal } from "../components/CustomModal";
import { useStore } from "../lib/store";
import { bodyProfileAt } from "../lib/calories";
import { computeStreak } from "../lib/streak";
import { liftMovement, rankHistory, recentRecords } from "../lib/progress";
import { closestTierUp, overallRank, rankLifts, tierLabel, TIER_COLORS } from "../lib/rank";
import { workoutSets, workoutVolume, type BodyPart, type Measurement } from "../types";

const DAY = 86400000;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const KINDS: { kind: string; unit: (u: string) => string }[] = [
  { kind: "Body weight", unit: (u) => u },
  { kind: "Body fat", unit: () => "%" },
  { kind: "Chest", unit: () => "cm" },
  { kind: "Waist", unit: () => "cm" },
  { kind: "Arm", unit: () => "cm" },
  { kind: "Thigh", unit: () => "cm" },
];

type Range = "6M" | "1Y" | "All";
const RANGE_DAYS: Record<Range, number> = { "6M": 182, "1Y": 365, All: 0 };

/** Monday 00:00 of the week containing ms (local, DST-safe). */
function weekStartOf(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function Segmented({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {(["6M", "1Y", "All"] as Range[]).map((r) => (
        <Pressable
          key={r}
          onPress={() => onChange(r)}
          style={{
            backgroundColor: value === r ? C.accent : C.page2,
            borderRadius: R.sm,
            paddingHorizontal: 11,
            paddingVertical: 5,
          }}
        >
          <Txt size={11.5} weight="bold" color={value === r ? C.accentInk : C.inkSoft}>{r}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

/** A row that opens a sub-page. */
function MoreRow({
  icon,
  title,
  value,
  onPress,
}: {
  icon: string;
  title: string;
  value: string;
  onPress: () => void;
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
          <Icon name={icon} size={17} color={C.ink} />
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

export function Stats() {
  const {
    workouts, exercises, routines, measurements,
    addMeasurement, deleteMeasurement, settings,
  } = useStore();
  const [range, setRange] = useState<Range>("6M");
  const [sub, setSub] = useState<"measure" | "load" | null>(null);
  const [width, setWidth] = useState(0);

  const now = Date.now();
  const finished = useMemo(() => workouts.filter((w) => w.endedAt), [workouts]);

  const from = useMemo(() => {
    if (range !== "All") return now - RANGE_DAYS[range] * DAY;
    const first = finished.reduce((m, w) => Math.min(m, w.startedAt), Number.POSITIVE_INFINITY);
    return Number.isFinite(first) ? first : now - 182 * DAY;
    // `now` moves every render but only by milliseconds; the window is in days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, finished]);

  const body = bodyProfileAt(settings, measurements, now);

  // Bodyweight AT A DATE, because DOTS divides by it: a lifter who gained
  // 5 kg without adding load really did score lower, and a fixed weight
  // would draw a flat line over a real decline.
  const bodyAt = useMemo(
    () => (ms: number) => {
      const p = bodyProfileAt(settings, measurements, ms);
      return { weightKg: p.weightKg, sex: p.sex };
    },
    [settings, measurements],
  );

  const history = useMemo(() => {
    const raw = rankHistory(finished, settings.unit, bodyAt, from, now, 32);
    // Drop the leading UNRANKED samples. Keeping them drew a vertical cliff
    // out of zero and made the delta read "+217 in 6 months", which is the
    // gain from not existing, true, and useless. The climb starts at the
    // first moment there was something to climb from.
    const first = raw.findIndex((p) => p.points > 0);
    return first <= 0 ? raw : raw.slice(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, settings.unit, bodyAt, from]);

  const lifts = useMemo(
    () => rankLifts(finished, settings.unit, body.weightKg, body.sex),
    [finished, settings.unit, body.weightKg, body.sex],
  );
  const overall = overallRank(lifts);
  const s = overall.state;
  const gained = history.length > 1 ? s.points - history[0].points : 0;
  /** "since May 26". Always true, unlike "in 6 months" when the data is younger. */
  const sinceLabel = history.length
    ? `${MONTHS[new Date(history[0].at).getMonth()].slice(0, 3)} ${String(
        new Date(history[0].at).getFullYear(),
      ).slice(2)}`
    : "";

  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";

  const moved = useMemo(
    () =>
      liftMovement(finished, from, now)
        .slice(0, 6)
        .map((m) => ({
          label: exName(m.exerciseId),
          from: Math.round(m.from),
          to: Math.round(m.to),
          isNew: m.isNew,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finished, from, exercises],
  );

  const records = useMemo(() => recentRecords(finished, 5), [finished]);

  /** The two lifts closest to a promotion, in kilos: what you do on Monday. */
  const tierUps = useMemo(() => {
    const out: { exerciseId: string; toGo: number; next: string; progress: number }[] = [];
    let pool = [...lifts];
    for (let i = 0; i < 2; i++) {
      const t = closestTierUp(pool, body.weightKg, body.sex, settings.unit);
      if (!t) break;
      const lift = pool.find((l) => l.exerciseId === t.exerciseId);
      out.push({ ...t, progress: lift?.tier.progress ?? 0 });
      pool = pool.filter((l) => l.exerciseId !== t.exerciseId);
    }
    return out;
  }, [lifts, body.weightKg, body.sex, settings.unit]);

  const streak = computeStreak(workouts, routines, now);
  const weightPoints = measurements
    .filter((m) => m.kind === "Body weight")
    .sort((a, b) => a.at - b.at)
    .slice(-12)
    .map((m) => m.value);

  const rangeLabel = range === "All" ? "all time" : range === "6M" ? "6 months" : "12 months";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: TOP_BAR_SPACE + 16,
          paddingBottom: 120,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PageTitle style={{ flex: 1 }}>Progress</PageTitle>
          <Segmented value={range} onChange={setRange} />
        </View>

        {/* ── 1. the climb ────────────────────────────────────────────── */}
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {lifts.length === 0 ? (
            <>
              <Eyebrow>Rank · overall</Eyebrow>
              <Txt size={13} color={C.inkFaint}>
                Finish a workout with weighted sets (10 reps or fewer) and your
                climb starts here.
              </Txt>
            </>
          ) : (
            <>
              <Eyebrow>Rank · overall</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Txt size={44} weight="extrabold" style={{ letterSpacing: -1.4 }}>
                  {Math.round(s.points)}
                </Txt>
                <Txt size={15} weight="extrabold" color={C.accent}>pts</Txt>
                {gained >= 1 ? (
                  <Txt size={13} weight="bold" color={C.goodAcc} style={{ marginLeft: "auto" }}>
                    ▲ +{Math.round(gained)} since {sinceLabel}
                  </Txt>
                ) : null}
              </View>

              <View style={{ marginTop: 12 }}>
                <RankLine points={history} width={width} />
              </View>

              <View style={{ marginTop: 10 }}>
                <Meter value={s.progress} />
              </View>
              <View style={{ flexDirection: "row", marginTop: 6 }}>
                <Txt size={11.5} weight="bold" color={TIER_COLORS[s.tier]}>{tierLabel(s)}</Txt>
                <Txt size={11.5} color={C.inkFaint} style={{ marginLeft: "auto" }}>
                  {s.next ? `${Math.ceil(s.toNext)} pts to ${s.next}` : "Top of the ladder"}
                </Txt>
              </View>
            </>
          )}
        </View>

        {/* ── 2. what moved ──────────────────────────────────────────── */}
        {moved.length > 0 ? (
          <>
            <Eyebrow>What moved · {rangeLabel} ({settings.unit})</Eyebrow>
            <Dumbbell rows={moved} width={width} />
            <Txt size={10.5} color={C.inkFaint} style={{ marginTop: 2 }}>
              Hollow dot = then, filled = now. A row with no gap is a lift that
              has stalled.
            </Txt>
          </>
        ) : null}

        {/* ── 3. closest tier-ups, in kilos ──────────────────────────── */}
        {tierUps.length > 0 ? (
          <>
            <Eyebrow>Closest tier-ups</Eyebrow>
            {tierUps.map((t, i) => (
              <View key={t.exerciseId}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: 10, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt size={14} weight="semibold" numberOfLines={1}>
                        {exName(t.exerciseId)}
                      </Txt>
                      <Txt size={11.5} color={C.inkFaint}>to {t.next}</Txt>
                    </View>
                    <Txt size={15} weight="extrabold" color={C.accent}>
                      +{t.toGo.toFixed(1)} {settings.unit}
                    </Txt>
                  </View>
                  <Meter value={t.progress} />
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* ── 4. records ─────────────────────────────────────────────── */}
        {records.length > 0 ? (
          <>
            <Eyebrow>Recent records</Eyebrow>
            {records.map((r, i) => (
              <View key={`${r.exerciseId}-${r.at}`}>
                {i > 0 ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 11,
                  }}
                >
                  <Icon name="Trophy" size={16} color={C.gold} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt size={13.5} weight="semibold" numberOfLines={1}>
                      {exName(r.exerciseId)} · {Math.round(r.e1RM)} {settings.unit}
                    </Txt>
                    <Txt size={11} color={C.inkFaint}>
                      {fmtDay(r.at)} · was {Math.round(r.previous)} {settings.unit}
                    </Txt>
                  </View>
                  <Txt size={14} weight="extrabold" color={C.gold}>
                    +{Math.round(r.e1RM - r.previous)}
                  </Txt>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* ── 5. body + consistency ──────────────────────────────────── */}
        <Eyebrow>Body &amp; consistency</Eyebrow>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={19} weight="extrabold">
              {Math.round(body.weightKg * 10) / 10}
              <Txt size={11} color={C.inkFaint}> kg</Txt>
            </Txt>
            <Txt size={9} weight="bold" color={C.inkFaint}>BODY WEIGHT</Txt>
            {weightPoints.length > 1 ? (
              <View style={{ marginTop: 4 }}>
                <Sparkline data={weightPoints} />
              </View>
            ) : (
              <Txt size={10.5} color={C.inkFaint} style={{ marginTop: 4 }}>
                Log it to see the trend: it divides your DOTS score.
              </Txt>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={19} weight="extrabold">{streak.current}</Txt>
            <Txt size={9} weight="bold" color={C.inkFaint}>DAY STREAK</Txt>
            <Txt size={10.5} color={C.inkFaint} style={{ marginTop: 4 }}>
              {streak.longest > 0 ? `Longest: ${streak.longest} days` : "No plan yet"}
            </Txt>
          </View>
        </View>

        {/* ── 6. the rest, one tap away ──────────────────────────────── */}
        <Eyebrow>More</Eyebrow>
        <MoreRow
          icon="Ruler"
          title="Measurements"
          value={`${measurements.length} logged · weight, body fat, chest…`}
          onPress={() => setSub("measure")}
        />
        <Divider />
        <MoreRow
          icon="ChartColumn"
          title="Training load"
          value="Volume, sets, hours and the muscle split"
          onPress={() => setSub("load")}
        />
      </ScrollView>

      {sub === "measure" ? (
        <MeasurementsPage
          onBack={() => setSub(null)}
          measurements={measurements}
          unitOf={(k) => KINDS.find((x) => x.kind === k)?.unit(settings.unit) ?? settings.unit}
          onAdd={addMeasurement}
          onDelete={deleteMeasurement}
          displayUnit={settings.unit}
        />
      ) : null}

      {sub === "load" ? (
        <TrainingLoadPage onBack={() => setSub(null)} />
      ) : null}
    </View>
  );
}

/** The old logging UI, now a sub-page instead of the tail of the tab. */
function MeasurementsPage({
  onBack,
  measurements,
  unitOf,
  onAdd,
  onDelete,
  displayUnit,
}: {
  onBack: () => void;
  measurements: Measurement[];
  unitOf: (kind: string) => string;
  onAdd: (kind: string, value: number, unit: string) => void;
  onDelete: (id: string) => void;
  displayUnit: string;
}) {
  const [kind, setKind] = useState(KINDS[0]);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState<Measurement | null>(null);
  const unit = kind.unit(displayUnit);
  const sorted = [...measurements].sort((a, b) => b.at - a.at);

  const submit = () => {
    const v = Number(value);
    if (!v) return;
    onAdd(kind.kind, v, unit);
    setValue("");
  };

  return (
    <SubPage title="Measurements" onBack={onBack}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {KINDS.map((k) => (
          <Pressable
            key={k.kind}
            onPress={() => setKind(k)}
            style={{
              backgroundColor: kind.kind === k.kind ? C.accent : C.page2,
              borderRadius: R.sm,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Txt size={12} weight="bold" color={kind.kind === k.kind ? C.accentInk : C.inkSoft}>
              {k.kind}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <NumberField value={value} onChange={setValue} suffix={unit} width={140} />
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Save" onPress={submit} disabled={!Number(value)} />
        </View>
      </View>

      <Eyebrow>Log</Eyebrow>
      {sorted.length === 0 ? (
        <Txt size={13} color={C.inkFaint}>No measurements yet.</Txt>
      ) : (
        sorted.map((m, i) => (
          <View key={m.id}>
            {i > 0 ? <Divider /> : null}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 10,
              }}
            >
              <View style={{ gap: 2 }}>
                <Txt weight="semibold">{m.kind}</Txt>
                <Txt size={11} color={C.inkFaint}>{new Date(m.at).toLocaleDateString()}</Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pill text={`${m.value} ${m.unit || unitOf(m.kind)}`} color={C.goodAcc} bg={C.goodSurf} />
                <Pressable hitSlop={8} onPress={() => setConfirming(m)}>
                  <Icon name="Trash2" size={15} color={C.inkFaint} />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}

      {confirming ? (
        <ConfirmModal
          title="Delete measurement?"
          message={`${confirming.kind}, ${confirming.value} ${confirming.unit} will be removed from the log.`}
          onConfirm={() => onDelete(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </SubPage>
  );
}

/**
 * Everything the old page led with. It is not wrong. It is just not the
 * headline, so it lives here for the sessions where you do want to know how
 * much you moved.
 */
function TrainingLoadPage({ onBack }: { onBack: () => void }) {
  const { workouts, exercises, settings } = useStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    if (delta > 0 && d.getTime() > new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return;
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const finished = workouts.filter((w) => w.endedAt);
  const inMonth = finished.filter((w) => w.startedAt >= monthStart && w.startedAt < monthEnd);
  const volume = inMonth.reduce((s, w) => s + workoutVolume(w), 0);
  const sets = inMonth.reduce((s, w) => s + workoutSets(w), 0);
  const hours = inMonth.reduce((s, w) => s + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / 3600000;

  // Weekly buckets: only weeks that actually contain something, so the
  // chart is never four fifths empty the way the old one was.
  const thisWeek = weekStartOf(Date.now());
  const buckets = new Map<number, { volume: number; count: number }>();
  for (const w of inMonth) {
    const k = weekStartOf(w.startedAt);
    const b = buckets.get(k) ?? { volume: 0, count: 0 };
    b.volume += workoutVolume(w);
    b.count += 1;
    buckets.set(k, b);
  }
  const weeks = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, b]) => ({
      label: `${new Date(start).getDate()}/${new Date(start).getMonth() + 1}`,
      value: Math.round(b.volume),
      count: b.count,
      highlight: start === thisWeek,
    }));

  const bodyPartOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const split = new Map<BodyPart, number>();
  for (const w of inMonth) {
    for (const e of w.entries) {
      const part = bodyPartOf.get(e.exerciseId);
      if (!part) continue;
      const vol = e.sets.reduce((t, x) => t + (x.type !== "warmup" ? x.weight * x.reps : 0), 0);
      if (vol > 0) split.set(part, (split.get(part) ?? 0) + vol);
    }
  }
  const all = [...split.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([part, vol]) => ({
      label: part[0].toUpperCase() + part.slice(1),
      value: Math.round(vol),
    }));
  const rows =
    all.length > 5
      ? [...all.slice(0, 4), { label: "Other", value: all.slice(4).reduce((s, r) => s + r.value, 0) }]
      : all;

  return (
    <SubPage title="Training load" onBack={onBack}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Txt size={14} weight="bold" color={C.inkSoft} style={{ flex: 1 }}>
          {MONTHS[month]} {year}
        </Txt>
        <Pressable hitSlop={8} onPress={() => step(-1)}>
          <Icon name="ChevronLeft" size={20} color={C.ink} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => step(1)} disabled={isCurrent}>
          <Icon name="ChevronRight" size={20} color={isCurrent ? C.inkFaint : C.ink} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          ["WORKOUTS", String(inMonth.length)],
          [`VOLUME (${settings.unit.toUpperCase()})`, fmtShort(volume)],
          ["SETS", String(sets)],
          ["HOURS", String(Math.round(hours))],
        ].map(([label, value]) => (
          <View key={label} style={{ flex: 1, gap: 2 }}>
            <Txt size={20} weight="extrabold">{value}</Txt>
            <Txt size={9} weight="bold" color={C.inkFaint}>{label}</Txt>
          </View>
        ))}
      </View>

      {/* Two weeks minimum: one bar is not a bar chart, it is the figure
          already printed above it. Empty weeks are dropped entirely, which
          is why the old version was four-fifths background. */}
      {weeks.length > 1 ? (
        <View style={{ gap: 10 }}>
          <Eyebrow style={{ marginTop: 8 }}>Volume · weekly ({settings.unit})</Eyebrow>
          <ProBars bars={weeks} />
        </View>
      ) : inMonth.length === 0 ? (
        <Txt size={13} color={C.inkFaint}>No sessions this month.</Txt>
      ) : null}

      {rows.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Eyebrow style={{ marginTop: 8 }}>Muscle breakdown</Eyebrow>
          <MuscleBreakdown
            rows={rows}
            caption={`Working-set volume · ${MONTHS[month]} ${year} (${settings.unit})`}
          />
        </View>
      ) : null}
    </SubPage>
  );
}
