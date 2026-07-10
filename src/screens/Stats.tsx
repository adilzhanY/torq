/**
 * Stats tab (replaced the Measure tab; measurements now live at the
 * bottom): the analytics home —
 *  - lifetime overview cards (workouts / volume / sets / hours)
 *  - weekly volume + weekly workout-count BarCharts (last 8 weeks,
 *    current week in lime)
 *  - muscle split HBars (working-set volume by body part, last 30 days)
 *  - body-weight LineChart from Measure entries
 *  - the measurement log (kind chips + value + history), unchanged.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE } from "../theme";
import { Icon } from "../components/Icon";
import { Card, NumberField, Pill, PrimaryButton, SectionTitle, Txt } from "../components/ui";
import { fmtShort } from "../components/charts";
import { MuscleBreakdown, ProBars, TrendLine } from "../components/ProCharts";
import { ConfirmDialog } from "../components/Dialog";
import { useStore } from "../lib/store";
import { workoutSets, workoutVolume, type BodyPart, type Measurement } from "../types";

const KINDS: { kind: string; unit: (u: string) => string }[] = [
  { kind: "Body weight", unit: (u) => u },
  { kind: "Body fat", unit: () => "%" },
  { kind: "Chest", unit: () => "cm" },
  { kind: "Waist", unit: () => "cm" },
  { kind: "Arm", unit: () => "cm" },
  { kind: "Thigh", unit: () => "cm" },
];

const DAY_MS = 86400000;

/** Monday 00:00 of the week containing ms (local, DST-safe). */
function weekStartOf(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4, alignItems: "center", paddingHorizontal: 8 }}>
      <Txt size={17} weight="extrabold">{value}</Txt>
      <Txt size={9} weight="bold" color={C.inkFaint}>{label}</Txt>
    </Card>
  );
}

export function Stats() {
  const { workouts, exercises, measurements, addMeasurement, deleteMeasurement, settings } =
    useStore();
  const [kind, setKind] = useState(KINDS[0]);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState<Measurement | null>(null);

  const unit = kind.unit(settings.unit);
  const sortedM = [...measurements].sort((a, b) => b.at - a.at);
  const finished = workouts.filter((w) => w.endedAt);

  // ----- Lifetime overview --------------------------------------------------
  const totalVolume = finished.reduce((s, w) => s + workoutVolume(w), 0);
  const totalSets = finished.reduce((s, w) => s + workoutSets(w), 0);
  const totalHours =
    finished.reduce((s, w) => s + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / 3600000;

  // ----- Weekly buckets (last 8 weeks incl. current) ------------------------
  const thisWeek = weekStartOf(Date.now());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(thisWeek);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * (7 - i)).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * (6 - i)).getTime();
    const inWeek = finished.filter((w) => w.startedAt >= start && w.startedAt < end);
    const s = new Date(start);
    return {
      label: `${s.getDate()}/${s.getMonth() + 1}`,
      volume: Math.round(inWeek.reduce((t, w) => t + workoutVolume(w), 0)),
      count: inWeek.length,
      highlight: start === thisWeek,
    };
  });

  // ----- Muscle split (last 30 days, working-set volume by body part) -------
  const bodyPartOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const splitSince = Date.now() - 30 * DAY_MS;
  const split = new Map<BodyPart, number>();
  for (const w of finished) {
    if (w.startedAt < splitSince) continue;
    for (const e of w.entries) {
      const part = bodyPartOf.get(e.exerciseId);
      if (!part) continue;
      const vol = e.sets.reduce(
        (t, s) => t + (s.type !== "warmup" ? s.weight * s.reps : 0),
        0,
      );
      if (vol > 0) split.set(part, (split.get(part) ?? 0) + vol);
    }
  }
  const splitAll = [...split.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([part, vol]) => ({
      label: part[0].toUpperCase() + part.slice(1),
      value: Math.round(vol),
    }));
  // Top 4 + everything else folded into "Other" (one stacked bar reads best).
  const splitRows =
    splitAll.length > 5
      ? [
          ...splitAll.slice(0, 4),
          { label: "Other", value: splitAll.slice(4).reduce((s, r) => s + r.value, 0) },
        ]
      : splitAll;

  // ----- Body weight trend --------------------------------------------------
  const weightPoints = measurements
    .filter((m) => m.kind === "Body weight")
    .sort((a, b) => a.at - b.at)
    .map((m) => ({ x: m.at, y: m.value }));

  const submit = () => {
    const v = Number(value);
    if (!v) return;
    addMeasurement(kind.kind, v, unit);
    setValue("");
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">Stats</Txt>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="WORKOUTS" value={String(finished.length)} />
        <Stat label={`VOLUME (${settings.unit.toUpperCase()})`} value={fmtShort(totalVolume)} />
        <Stat label="SETS" value={String(totalSets)} />
        <Stat label="HOURS" value={fmtShort(Math.round(totalHours))} />
      </View>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Volume · weekly ({settings.unit})</SectionTitle>
        <ProBars bars={weeks.map((w) => ({ label: w.label, value: w.volume, highlight: w.highlight }))} />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>Workouts · weekly</SectionTitle>
        <ProBars
          height={80}
          bars={weeks.map((w) => ({ label: w.label, value: w.count, highlight: w.highlight }))}
          formatValue={(v) => String(v)}
        />
      </Card>

      {splitRows.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <SectionTitle>Muscle breakdown</SectionTitle>
          <MuscleBreakdown rows={splitRows} caption={`Working-set volume · last 30 days (${settings.unit})`} />
        </Card>
      ) : null}

      {weightPoints.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <SectionTitle>Body weight ({settings.unit})</SectionTitle>
          <TrendLine
            points={weightPoints}
            unit={settings.unit}
            color={C.goodAcc}
            height={140}
            formatValue={(v) => `${Math.round(v * 10) / 10}`}
          />
          <Txt size={10} color={C.inkFaint}>Hold a point to inspect it.</Txt>
        </Card>
      ) : null}

      <SectionTitle>Log a measurement</SectionTitle>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {KINDS.map((k) => (
            <Pressable
              key={k.kind}
              onPress={() => setKind(k)}
              style={{
                backgroundColor: kind.kind === k.kind ? C.primary : C.page2,
                borderRadius: R.pill,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Txt size={12} weight="bold" color={kind.kind === k.kind ? "#fff" : C.inkSoft}>
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
      </Card>

      <SectionTitle>Measurement log</SectionTitle>
      {sortedM.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>No measurements yet.</Txt>
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {sortedM.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: "rgba(20,26,24,0.06)" }} /> : null}
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
                  <Txt size={11} color={C.inkFaint}>
                    {new Date(m.at).toLocaleDateString()}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pill text={`${m.value} ${m.unit}`} color={C.goodAcc} bg={C.goodSurf} />
                  <Pressable hitSlop={8} onPress={() => setConfirming(m)}>
                    <Icon name="Trash2" size={15} color={C.inkFaint} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>

      {confirming ? (
        <ConfirmDialog
          title="Delete measurement?"
          message={`${confirming.kind} — ${confirming.value} ${confirming.unit} will be removed from the log.`}
          onConfirm={() => deleteMeasurement(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </View>
  );
}
