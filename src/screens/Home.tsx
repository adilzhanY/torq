/**
 * Home tab — the coach's "Today" screen. Date header + calendar dialog +
 * scrubbable DateRuler, then:
 *  - HERO (always about the real today): today's planned workout with a
 *    one-tap Start (live session → jump back in; done → checked off;
 *    rest day → next session preview; no plan → build-plan CTA).
 *  - Goal card: burnt calories vs the daily goal (SegmentedBar, selected
 *    day) + three plan-derived week gauges (workouts / sets / minutes vs
 *    what the plan routines actually prescribe — nothing typed by hand).
 *  - 7-day volume sparkline (teaser for the Progress tab).
 *  - Day-aware workout list (Today → recents; other days → that day).
 */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { PopIn, Squish } from "../components/anim";
import { Card, Divider, SectionTitle, Txt } from "../components/ui";
import { ArcGauge, SegmentedBar, Sparkline } from "../components/charts";
import { CalendarDialog } from "../components/CalendarDialog";
import { DateRuler, addDays, dayStart } from "../components/DateRuler";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { bodyProfileAt, workoutCalories } from "../lib/calories";
import { routineMinutes, routineSets } from "../lib/plan";
import { kcalGoal } from "../lib/stats";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import { workoutSets, workoutVolume, type Routine, type Workout } from "../types";

const DAY_MS = 86400000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday 00:00 of the week containing `dayMs` (local). */
function weekStartOf(dayMs: number): number {
  const d = new Date(dayMs);
  return addDays(dayMs, -((d.getDay() + 6) % 7));
}

/** Hero card — today's planned session, in one of its states. */
function TodayHero({
  routine,
  done,
  nextUp,
}: {
  routine: Routine | null;
  done: boolean;
  nextUp: Routine | null;
}) {
  const { exercises, activeWorkout, settings, startWorkout } = useStore();
  const { setTab, openPlanWizard } = useUi();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";

  // Live session → jump back in (same lime state as before).
  if (activeWorkout) {
    return (
      <Squish
        onPress={() => setTab("workout")}
        style={[
          {
            backgroundColor: C.accent,
            borderRadius: R.md,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          },
          clay(),
        ]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accentInk, alignItems: "center", justifyContent: "center" }}>
          <Icon name="Timer" size={20} color={C.accent} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Txt size={16} weight="extrabold" color={C.accentInk}>Workout in progress</Txt>
          <Txt size={12} color="rgba(26,27,26,0.7)">Jump back into your session</Txt>
        </View>
      </Squish>
    );
  }

  // No plan yet → the wizard is the action.
  if (!settings.plan) {
    return (
      <Squish
        onPress={openPlanWizard}
        style={[
          {
            backgroundColor: C.primary,
            borderRadius: R.md,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          },
          clay(),
        ]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Icon name="Sparkles" size={20} color={C.accentInk} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Txt size={16} weight="extrabold" color="#fff">Build your training plan</Txt>
          <Txt size={12} color="rgba(255,255,255,0.7)">
            A few questions — Torq plans your whole week
          </Txt>
        </View>
      </Squish>
    );
  }

  // Today's session already finished → checked off.
  if (routine && done) {
    return (
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.goodSurf, alignItems: "center", justifyContent: "center" }}>
          <Icon name="Check" size={20} color={C.goodAcc} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Txt size={16} weight="extrabold">{routine.name} — done</Txt>
          <Txt size={12} color={C.inkFaint}>Nice work. Recovery starts now.</Txt>
        </View>
      </Card>
    );
  }

  // Training day → the one-tap start card.
  if (routine) {
    const preview = routine.entries.slice(0, 3).map((e) => name(e.exerciseId));
    const more = routine.entries.length - preview.length;
    return (
      <Squish
        onPress={() => {
          startWorkout(routine);
          setTab("workout");
        }}
        style={[
          { backgroundColor: C.primary, borderRadius: R.md, padding: 18, gap: 12 },
          clay(),
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Play" size={22} color={C.accentInk} />
          </View>
          <View style={{ gap: 2, flex: 1 }}>
            <Txt size={11} weight="bold" color={C.accent}>TODAY'S WORKOUT</Txt>
            <Txt size={17} weight="extrabold" color="#fff">{routine.name}</Txt>
            <Txt size={12} color="rgba(255,255,255,0.7)">
              {routine.entries.length} exercises · {routineSets(routine)} sets · ~
              {routineMinutes(routine, settings.restSec)} min
            </Txt>
          </View>
        </View>
        <Txt size={12} color="rgba(255,255,255,0.55)" numberOfLines={2}>
          {preview.join("  ·  ")}
          {more > 0 ? `  ·  +${more} more` : ""}
        </Txt>
      </Squish>
    );
  }

  // Rest day.
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.page2, alignItems: "center", justifyContent: "center" }}>
        <Icon name="Moon" size={20} color={C.inkSoft} />
      </View>
      <View style={{ gap: 2, flex: 1 }}>
        <Txt size={16} weight="extrabold">Rest day</Txt>
        <Txt size={12} color={C.inkFaint}>
          {nextUp && nextUp.weekday != null
            ? `Recovery is training. Next up: ${DAYS[nextUp.weekday]} — ${nextUp.name}.`
            : "Recovery is training."}
        </Txt>
      </View>
    </Card>
  );
}

export function Home() {
  const { workouts, activeWorkout, exercises, measurements, routines, settings } = useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [day, setDay] = useState(() => dayStart(Date.now()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const now = Date.now();
  const today = dayStart(now);
  const isToday = day === today;
  const d = new Date(day);
  const title = isToday ? "Today" : day === addDays(today, -1) ? "Yesterday" : DAYS[d.getDay()];
  const subtitle = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${DAYS[d.getDay()]}`;

  // ----- Hero data (always the real today) ----------------------------------
  const todaysRoutine = routines.find((r) => r.plan && r.weekday === new Date(today).getDay()) ?? null;
  const doneToday =
    !!todaysRoutine && workouts.some((w) => dayStart(w.startedAt) === today && w.routineId === todaysRoutine.id);
  const nextUp = (() => {
    for (let i = 1; i <= 7; i++) {
      const wd = new Date(addDays(today, i)).getDay();
      const r = routines.find((x) => x.plan && x.weekday === wd);
      if (r) return r;
    }
    return null;
  })();

  // ----- Selected-day data --------------------------------------------------
  const dayFinished = workouts.filter((w) => dayStart(w.startedAt) === day);
  const dayAll = [...dayFinished, ...(isToday && activeWorkout ? [activeWorkout] : [])];
  const profile = bodyProfileAt(settings, measurements, day + DAY_MS - 1);
  const kcal = dayAll.reduce(
    (s, w) => s + workoutCalories(w, exercises, profile, settings),
    0,
  );

  // ----- Week-of-selected-day vs what the plan prescribes -------------------
  const weekStart = weekStartOf(day);
  const weekEnd = addDays(weekStart, 7);
  const week = workouts.filter((w) => w.startedAt >= weekStart && w.startedAt < weekEnd);
  const weekLive = isToday && activeWorkout ? [...week, activeWorkout] : week;
  const planRoutines = routines.filter((r) => r.plan);
  const target = {
    // Fallbacks for the plan-less: modest, invisible once a plan exists.
    workouts: planRoutines.length || 3,
    sets: planRoutines.reduce((s, r) => s + routineSets(r), 0) || 60,
    minutes: planRoutines.reduce((s, r) => s + routineMinutes(r, settings.restSec), 0) || 180,
  };
  const weekDone = {
    workouts: week.length,
    sets: weekLive.reduce((s, w) => s + workoutSets(w), 0),
    minutes: Math.round(
      weekLive.reduce((s, w) => s + ((w.endedAt ?? now) - w.startedAt), 0) / 60000,
    ),
  };

  // 7-day volume trend ending on the selected day.
  const trend = Array.from({ length: 7 }, (_, i) => {
    const dStart = addDays(day, i - 6);
    return workouts
      .filter((w) => dayStart(w.startedAt) === dStart)
      .reduce((s, w) => s + workoutVolume(w), 0);
  });

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

      <TodayHero routine={todaysRoutine} done={doneToday} nextUp={nextUp} />

      {/* Daily goal card: calories for the selected day, plan-relative week gauges */}
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Txt size={10} weight="bold" color={C.inkFaint}>BURNT</Txt>
            <Txt size={26} weight="extrabold">{kcal}</Txt>
          </View>
          <View style={{ gap: 2, alignItems: "flex-end" }}>
            <Txt size={10} weight="bold" color={C.inkFaint}>GOAL</Txt>
            <Txt size={26} weight="extrabold" color={C.inkSoft}>{kcalGoal(settings)}</Txt>
          </View>
        </View>
        <SegmentedBar value={kcal} goal={kcalGoal(settings)} />
        {!profile.complete ? (
          <Txt size={11} color={C.inkFaint}>
            Set your body stats in Profile for accurate calories.
          </Txt>
        ) : null}
        <Divider />
        <Txt size={10} weight="bold" color={C.inkFaint}>
          {isToday ? "THIS WEEK VS YOUR PLAN" : "THAT WEEK VS YOUR PLAN"}
        </Txt>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <ArcGauge value={weekDone.workouts} goal={target.workouts} label="WORKOUTS" color={C.goodAcc} />
          <ArcGauge value={weekDone.sets} goal={target.sets} label="SETS" color={C.prAcc} />
          <ArcGauge value={weekDone.minutes} goal={target.minutes} label="MINUTES" color={C.warnAcc} />
        </View>
      </Card>

      {/* Volume trend teaser (full Progress tab coming) */}
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={10} weight="bold" color={C.inkFaint}>
            VOLUME · LAST 7 DAYS ({settings.unit.toUpperCase()})
          </Txt>
          <Txt size={13} weight="extrabold">{Math.round(trend.reduce((a, b) => a + b, 0))}</Txt>
        </View>
        <Sparkline data={trend} />
      </Card>

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
