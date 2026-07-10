/**
 * Home tab — a day-centric dashboard (nutrition-app reference): big date
 * header + calendar button (custom CalendarDialog), a scrubbable DateRuler,
 * and a daily-goal card — burnt calories vs goal on a SegmentedBar, then
 * three ArcGauges (active minutes / sets / volume vs their goals, edited in
 * Profile). Picking a date drives the goal card AND the workout list below
 * (Today → 3 most recent overall; other days → that day's workouts). The
 * week stats and the workout CTA stay date-independent.
 */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { PopIn, Squish } from "../components/anim";
import { Card, Divider, SectionTitle, Txt } from "../components/ui";
import { ArcGauge, SegmentedBar } from "../components/charts";
import { CalendarDialog } from "../components/CalendarDialog";
import { DateRuler, addDays, dayStart } from "../components/DateRuler";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { bodyProfileAt, workoutCalories } from "../lib/calories";
import { dailyGoals } from "../lib/stats";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import { workoutSets, workoutVolume, type Workout } from "../types";

const DAY_MS = 86400000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4, alignItems: "center" }}>
      <Txt size={18} weight="extrabold">{value}</Txt>
      <Txt size={10} weight="bold" color={C.inkFaint}>{label}</Txt>
    </Card>
  );
}

/** Monday 00:00 of the current week, local time. */
function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function Home() {
  const { workouts, activeWorkout, exercises, measurements, settings } = useStore();
  const { setTab } = useUi();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [day, setDay] = useState(() => dayStart(Date.now()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const now = Date.now();
  const today = dayStart(now);
  const isToday = day === today;
  const d = new Date(day);
  const title = isToday ? "Today" : day === addDays(today, -1) ? "Yesterday" : DAYS[d.getDay()];
  const subtitle = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${DAYS[d.getDay()]}`;

  // ----- Selected-day data --------------------------------------------------
  const dayFinished = workouts.filter((w) => dayStart(w.startedAt) === day);
  const dayAll = [...dayFinished, ...(isToday && activeWorkout ? [activeWorkout] : [])];
  const profile = bodyProfileAt(settings, measurements, day + DAY_MS - 1);
  const goals = dailyGoals(settings);
  const kcal = dayAll.reduce(
    (s, w) => s + workoutCalories(w, exercises, profile, settings),
    0,
  );
  const activeMin = Math.round(
    dayAll.reduce((s, w) => s + ((w.endedAt ?? now) - w.startedAt), 0) / 60000,
  );
  const sets = dayAll.reduce((s, w) => s + workoutSets(w), 0);
  const volume = Math.round(dayAll.reduce((s, w) => s + workoutVolume(w), 0));

  // ----- Week + recents (date-independent) ----------------------------------
  const weekStart = startOfWeek();
  const week = workouts.filter((w) => w.startedAt >= weekStart);
  const weekVolume = Math.round(week.reduce((s, w) => s + workoutVolume(w), 0));
  const weekSets = week.reduce((s, w) => s + workoutSets(w), 0);
  const recent = [...workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  const listed = isToday ? recent : [...dayFinished].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
      {/* Date header + calendar button */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <PopIn key={day} style={{ flex: 1, gap: 2 }}>
          <Txt size={26} weight="extrabold">{title}</Txt>
          <Txt size={15} weight="bold" color={C.inkFaint}>{subtitle}</Txt>
        </PopIn>
        <Squish
          onPress={() => setCalendarOpen(true)}
          style={[
            {
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: C.surface,
              alignItems: "center",
              justifyContent: "center",
            },
            claySm(),
          ]}
        >
          <Icon name="CalendarDays" size={20} color={C.ink} />
        </Squish>
      </View>

      {/* Bleed the ruler to the screen edges (cancels the scroll padding). */}
      <View style={{ marginHorizontal: -16 }}>
        <DateRuler date={day} onChange={setDay} />
      </View>

      {/* Daily goal card */}
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Txt size={10} weight="bold" color={C.inkFaint}>BURNT</Txt>
            <Txt size={26} weight="extrabold">{kcal}</Txt>
          </View>
          <View style={{ gap: 2, alignItems: "flex-end" }}>
            <Txt size={10} weight="bold" color={C.inkFaint}>GOAL</Txt>
            <Txt size={26} weight="extrabold" color={C.inkSoft}>{goals.kcal}</Txt>
          </View>
        </View>
        <SegmentedBar value={kcal} goal={goals.kcal} />
        {!profile.complete ? (
          <Txt size={11} color={C.inkFaint}>
            Set your body stats in Profile for accurate calories.
          </Txt>
        ) : null}
        <Divider />
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <ArcGauge value={activeMin} goal={goals.activeMin} label="MINUTES" color={C.warnAcc} />
          <ArcGauge value={sets} goal={goals.sets} label="SETS" color={C.goodAcc} />
          <ArcGauge value={volume} goal={goals.volume} label={`VOLUME (${settings.unit.toUpperCase()})`} color={C.prAcc} />
        </View>
      </Card>

      <SectionTitle>This week</SectionTitle>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="WORKOUTS" value={String(week.length)} />
        <Stat label="SETS" value={String(weekSets)} />
        <Stat label={`VOLUME (${settings.unit.toUpperCase()})`} value={String(weekVolume)} />
      </View>

      {/* Same dark CTA as the Workout tab's quick start — here it jumps to
          the session (live) or the Start Workout screen. */}
      <Squish
        onPress={() => setTab("workout")}
        style={[
          {
            backgroundColor: activeWorkout ? C.accent : C.primary,
            borderRadius: R.md,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          },
          clay(),
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: activeWorkout ? C.accentInk : C.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={activeWorkout ? "Timer" : "Play"}
            size={20}
            color={activeWorkout ? C.accent : C.accentInk}
          />
        </View>
        <View style={{ gap: 2 }}>
          <Txt size={16} weight="extrabold" color={activeWorkout ? C.accentInk : "#fff"}>
            {activeWorkout ? "Workout in progress" : "Start a workout"}
          </Txt>
          <Txt size={12} color={activeWorkout ? "rgba(26,27,26,0.7)" : "rgba(255,255,255,0.7)"}>
            {activeWorkout ? "Jump back into your session" : "Quick start or pick a routine"}
          </Txt>
        </View>
      </Squish>

      <SectionTitle>
        {isToday ? "Recent workouts" : `Workouts · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`}
      </SectionTitle>
      {listed.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>
            {isToday
              ? "No workouts yet — your latest sessions will show up here."
              : "No workouts on this day."}
          </Txt>
        </Card>
      ) : (
        listed.map((w) => (
          <WorkoutCard key={w.id} workout={w} onPress={() => setSelected(w)} />
        ))
      )}
    </ScrollView>

      {selected ? (
        <WorkoutSummary workout={selected} onClose={() => setSelected(null)} />
      ) : null}

      {calendarOpen ? (
        <CalendarDialog
          date={day}
          onPick={setDay}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
    </View>
  );
}
