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
import { C, R, TOP_BAR_SPACE, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { Card, NumberField, Pill, PrimaryButton, SectionTitle, Txt } from "../components/ui";
import { fmtShort } from "../components/charts";
import { MuscleBreakdown, ProBars, TrendLine } from "../components/ProCharts";
import { ConfirmDialog } from "../components/Dialog";
import { useStore } from "../lib/store";
import { computeStreak } from "../lib/streak";
import { workoutSets, workoutVolume, type BodyPart, type Measurement } from "../types";

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
  const { workouts, exercises, routines, measurements, addMeasurement, deleteMeasurement, settings } =
    useStore();
  const [kind, setKind] = useState(KINDS[0]);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState<Measurement | null>(null);

  // Month Switcher state
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    const today = new Date();
    if (currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth < today.getMonth())) {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    }
  };

  const today = new Date();
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

  const monthStart = new Date(currentYear, currentMonth, 1).getTime();
  const monthEnd = new Date(currentYear, currentMonth + 1, 1).getTime();

  const unit = kind.unit(settings.unit);
  const monthMeasurements = measurements.filter((m) => m.at >= monthStart && m.at < monthEnd);
  const sortedM = [...monthMeasurements].sort((a, b) => b.at - a.at);
  
  const finished = workouts.filter((w) => w.endedAt);
  const monthWorkouts = finished.filter((w) => w.startedAt >= monthStart && w.startedAt < monthEnd);

  // ----- Overview stats (filtered by selected month) ------------------------
  const totalVolume = monthWorkouts.reduce((s, w) => s + workoutVolume(w), 0);
  const totalSets = monthWorkouts.reduce((s, w) => s + workoutSets(w), 0);
  const totalHours =
    monthWorkouts.reduce((s, w) => s + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / 3600000;

  // ----- Weekly buckets (weeks starting or falling in the selected month) ----
  const firstDay = new Date(currentYear, currentMonth, 1);
  const firstMonday = weekStartOf(firstDay.getTime());
  const lastDay = new Date(currentYear, currentMonth + 1, 0); // last day of the month
  const endLimit = lastDay.getTime();

  let currentWeekStart = firstMonday;
  const weeks = [];
  const thisWeekStart = weekStartOf(Date.now());
  
  while (currentWeekStart <= endLimit) {
    const start = currentWeekStart;
    const end = start + 7 * DAY_MS;
    const inWeek = finished.filter((w) => w.startedAt >= start && w.startedAt < end);
    const s = new Date(start);
    weeks.push({
      label: `${s.getDate()}/${s.getMonth() + 1}`,
      volume: Math.round(inWeek.reduce((t, w) => t + workoutVolume(w), 0)),
      count: inWeek.length,
      highlight: start === thisWeekStart,
    });
    currentWeekStart += 7 * DAY_MS;
  }

  // ----- Muscle split (working-set volume by body part, selected month) -------
  const bodyPartOf = new Map(exercises.map((e) => [e.id, e.bodyPart]));
  const split = new Map<BodyPart, number>();
  for (const w of monthWorkouts) {
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

  // ----- Body weight trend (selected month) ---------------------------------
  const weightPoints = measurements
    .filter((m) => m.kind === "Body weight" && m.at >= monthStart && m.at < monthEnd)
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

      {/* Month Switcher */}
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: C.surface,
            borderRadius: R.md,
            paddingHorizontal: 16,
            paddingVertical: 12,
          },
          claySm(),
        ]}
      >
        <Pressable hitSlop={12} onPress={prevMonth}>
          <Icon name="ChevronLeft" size={22} color={C.ink} />
        </Pressable>
        <Txt size={16} weight="extrabold" color={C.ink}>
          {MONTHS[currentMonth]} {currentYear}
        </Txt>
        <Pressable hitSlop={12} onPress={nextMonth} disabled={isCurrentMonth} style={{ opacity: isCurrentMonth ? 0.3 : 1 }}>
          <Icon
            name="ChevronRight"
            size={22}
            color={isCurrentMonth ? C.inkFaint : C.ink}
          />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="WORKOUTS" value={String(monthWorkouts.length)} />
        <Stat label={`VOLUME (${settings.unit.toUpperCase()})`} value={fmtShort(totalVolume)} />
        <Stat label="SETS" value={String(totalSets)} />
        <Stat label="HOURS" value={fmtShort(Math.round(totalHours))} />
      </View>

      {/* Lifetime streaks (not month-scoped — a streak has no month). */}
      {(() => {
        const streak = computeStreak(workouts, routines, Date.now());
        if (!streak.hasPlan) return null;
        return (
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="Flame" size={20} color={C.warnAcc} />
              <View style={{ gap: 1 }}>
                <Txt size={17} weight="extrabold">{streak.current}</Txt>
                <Txt size={9} weight="bold" color={C.inkFaint}>CURRENT STREAK</Txt>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="Trophy" size={20} color={C.gold} />
              <View style={{ gap: 1 }}>
                <Txt size={17} weight="extrabold">{streak.longest}</Txt>
                <Txt size={9} weight="bold" color={C.inkFaint}>LONGEST STREAK</Txt>
              </View>
            </View>
          </Card>
        );
      })()}

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
          <MuscleBreakdown rows={splitRows} caption={`Working-set volume · ${MONTHS[currentMonth]} ${currentYear} (${settings.unit})`} />
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
