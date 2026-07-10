/**
 * Home tab — the landing dashboard: this week's numbers, a jump back into a
 * live session (or a nudge to start one), and the most recent workouts.
 */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE, clay } from "../theme";
import { Icon } from "../components/Icon";
import { Squish } from "../components/anim";
import { Card, SectionTitle, Txt } from "../components/ui";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { bodyProfileAt, workoutCalories } from "../lib/calories";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import { workoutSets, workoutVolume, type Workout } from "../types";

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

  const weekStart = startOfWeek();
  const week = workouts.filter((w) => w.startedAt >= weekStart);
  const weekVolume = Math.round(week.reduce((s, w) => s + workoutVolume(w), 0));
  const weekSets = week.reduce((s, w) => s + workoutSets(w), 0);
  const recent = [...workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);

  // Calories burnt today: finished workouts + the live session so far.
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const profile = bodyProfileAt(settings, measurements, now);
  const today = [...workouts.filter((w) => w.startedAt >= dayStart && w.endedAt), activeWorkout]
    .filter((w): w is Workout => !!w);
  const todayKcal = today.reduce(
    (s, w) => s + workoutCalories(w, exercises, profile, settings),
    0,
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">Home</Txt>

      <SectionTitle>Today</SectionTitle>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: C.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Flame" size={20} color={C.accentInk} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Txt size={18} weight="extrabold">{todayKcal} kcal</Txt>
          <Txt size={10} weight="bold" color={C.inkFaint}>
            {profile.complete
              ? "CALORIES BURNT"
              : "CALORIES BURNT — set your body stats in Profile for accuracy"}
          </Txt>
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

      <SectionTitle>Recent workouts</SectionTitle>
      {recent.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>
            No workouts yet — your latest sessions will show up here.
          </Txt>
        </Card>
      ) : (
        recent.map((w) => (
          <WorkoutCard key={w.id} workout={w} onPress={() => setSelected(w)} />
        ))
      )}
    </ScrollView>

      {selected ? (
        <WorkoutSummary workout={selected} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  );
}
