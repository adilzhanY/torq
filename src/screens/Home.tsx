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
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { PopIn, Squish } from "../components/anim";
import { Divider, Eyebrow, Txt } from "../components/ui";
import { ArcGauge, SegmentedBar, Sparkline } from "../components/charts";
import { CalendarDialog } from "../components/CalendarDialog";
import { StreakDialog } from "../components/StreakDialog";
import { computeStreak, type Streak } from "../lib/streak";
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

/**
 * Flame pill on the Today heading. Lime = streak safe for today, ink =
 * today's planned session still pending, orange = one missed session from
 * losing it, faint = no live streak.
 */
function StreakPill({
  streak,
  todayPending,
  onPress,
}: {
  streak: Streak;
  todayPending: boolean;
  onPress: () => void;
}) {
  const dead = streak.current === 0;
  const [bg, fg] = streak.atRisk
    ? [C.warnSurf, C.warnAcc]
    : dead
      ? [C.page2, C.inkFaint]
      : todayPending
        ? [C.page2, C.ink]
        : [C.accent, C.accentInk];
  return (
    <Squish
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: bg,
        borderRadius: R.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Icon name="Flame" size={15} color={fg} />
      <Txt size={14} weight="extrabold" color={fg}>{streak.current}</Txt>
    </Squish>
  );
}

/** Monday 00:00 of the week containing `dayMs` (local). */
function weekStartOf(dayMs: number): number {
  const d = new Date(dayMs);
  return addDays(dayMs, -((d.getDay() + 6) % 7));
}

/**
 * CARDLESS hero — today's planned session as a typographic block: eyebrow
 * label, big title, dim meta, and (when there's an action) a lime pill.
 * Only the live-session state keeps a full lime surface — it's a giant
 * interactive CTA.
 */
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

  const limePill = (label: string, onPress: () => void) => (
    <Squish
      onPress={onPress}
      style={{
        alignSelf: "flex-start",
        marginTop: 10,
        backgroundColor: C.accent,
        borderRadius: R.pill,
        paddingHorizontal: 20,
        paddingVertical: 9,
      }}
    >
      <Txt size={13} weight="extrabold" color={C.accentInk}>{label}</Txt>
    </Squish>
  );

  // Live session → jump back in (interactive lime surface, kept).
  if (activeWorkout) {
    return (
      <View>
        <Eyebrow>Today's session</Eyebrow>
        <Squish
          onPress={() => setTab("workout")}
          style={[
            {
              backgroundColor: C.accent,
              borderRadius: R.md,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            },
            claySm(),
          ]}
        >
          <Icon name="Timer" size={22} color={C.accentInk} />
          <View style={{ gap: 1, flex: 1 }}>
            <Txt size={15} weight="extrabold" color={C.accentInk}>Workout in progress</Txt>
            <Txt size={12} color="rgba(26,27,26,0.7)">Jump back into your session</Txt>
          </View>
        </Squish>
      </View>
    );
  }

  // No plan yet → the wizard is the action.
  if (!settings.plan) {
    return (
      <View>
        <Eyebrow>Training plan</Eyebrow>
        <Txt size={20} weight="extrabold">No plan yet</Txt>
        <Txt size={13} color={C.inkSoft} style={{ marginTop: 2 }}>
          A few questions — Torq plans your whole week.
        </Txt>
        {limePill("Build my plan →", openPlanWizard)}
      </View>
    );
  }

  // Today's session already finished → checked off.
  if (routine && done) {
    return (
      <View>
        <Eyebrow>Today's session</Eyebrow>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt size={20} weight="extrabold">{routine.name} — done</Txt>
          <Icon name="Check" size={19} color={C.accent} />
        </View>
        <Txt size={13} color={C.inkFaint} style={{ marginTop: 2 }}>
          Nice work. Recovery starts now.
        </Txt>
      </View>
    );
  }

  // Training day → headline + one-tap Start pill.
  if (routine) {
    const preview = routine.entries.slice(0, 3).map((e) => name(e.exerciseId));
    const more = routine.entries.length - preview.length;
    return (
      <View>
        <Eyebrow>Today's session</Eyebrow>
        <Txt size={20} weight="extrabold">{routine.name}</Txt>
        <Txt size={13} color={C.inkSoft} style={{ marginTop: 2 }}>
          {routine.entries.length} exercises · {routineSets(routine)} sets · ~
          {routineMinutes(routine, settings.restSec)} min
        </Txt>
        <Txt size={12} color={C.inkFaint} numberOfLines={2} style={{ marginTop: 2 }}>
          {preview.join(" · ")}
          {more > 0 ? ` · +${more} more` : ""}
        </Txt>
        {limePill("Start →", () => {
          startWorkout(routine);
          setTab("workout");
        })}
      </View>
    );
  }

  // Rest day.
  return (
    <View>
      <Eyebrow>Today's session</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt size={20} weight="extrabold">Rest day</Txt>
        <Icon name="Moon" size={17} color={C.inkSoft} />
      </View>
      <Txt size={13} color={C.inkFaint} style={{ marginTop: 2 }}>
        {nextUp && nextUp.weekday != null
          ? `Recovery is training. Next up: ${DAYS[nextUp.weekday]} — ${nextUp.name}.`
          : "Recovery is training."}
      </Txt>
    </View>
  );
}

export function Home() {
  const { workouts, activeWorkout, exercises, measurements, routines, settings, updateSettings } =
    useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [day, setDay] = useState(() => dayStart(Date.now()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);

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

  // ----- Streak (plan-aware, see lib/streak.ts) -----------------------------
  const streak = computeStreak(workouts, routines, now);
  const todayHit = workouts.some((w) => w.endedAt && dayStart(w.startedAt) === today);
  const streakTodayPending = !!todaysRoutine && !todayHit;

  // Auto-celebrate: the first Home visit after logging today's first
  // workout pops the streak modal, once per trained day.
  useEffect(() => {
    if (!todayHit || streak.current === 0 || settings.streakCelebratedDay === today) return;
    updateSettings({ streakCelebratedDay: today });
    // No cleanup: marking the day re-runs this effect immediately, and a
    // cleanup would cancel the timer before the dialog ever opened.
    setTimeout(() => setStreakOpen(true), 450); // let the tab settle first
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayHit, today, settings.streakCelebratedDay]);

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Txt size={26} weight="extrabold">{title}</Txt>
            {streak.hasPlan ? (
              <StreakPill
                streak={streak}
                todayPending={streakTodayPending}
                onPress={() => setStreakOpen(true)}
              />
            ) : null}
          </View>
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

      {/* Daily goal — bare block: calories for the selected day, plan-relative week gauges */}
      <View>
        <Eyebrow>{isToday ? "Daily goal" : "That day"}</Eyebrow>
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
        <View style={{ marginTop: 10 }}>
          <SegmentedBar value={kcal} goal={kcalGoal(settings)} />
        </View>
        {!profile.complete ? (
          <Txt size={11} color={C.inkFaint} style={{ marginTop: 8 }}>
            Set your body stats in Profile for accurate calories.
          </Txt>
        ) : null}
        <View style={{ marginVertical: 14 }}><Divider /></View>
        <Txt size={10} weight="bold" color={C.inkFaint}>
          {isToday ? "THIS WEEK VS YOUR PLAN" : "THAT WEEK VS YOUR PLAN"}
        </Txt>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 10 }}>
          <ArcGauge value={weekDone.workouts} goal={target.workouts} label="WORKOUTS" color={C.goodAcc} />
          <ArcGauge value={weekDone.sets} goal={target.sets} label="SETS" color={C.prAcc} />
          <ArcGauge value={weekDone.minutes} goal={target.minutes} label="MINUTES" color={C.warnAcc} />
        </View>
      </View>

      {/* Volume trend teaser — frameless chart */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow style={{ marginTop: 0, marginBottom: 0 }}>
            Volume · last 7 days ({settings.unit})
          </Eyebrow>
          <Txt size={13} weight="extrabold">{Math.round(trend.reduce((a, b) => a + b, 0))}</Txt>
        </View>
        <View style={{ marginTop: 8 }}>
          <Sparkline data={trend} />
        </View>
      </View>

      <Eyebrow>
        {isToday ? "Recent workouts" : `Workouts · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`}
      </Eyebrow>
      {listed.length === 0 ? (
        <Txt size={13} color={C.inkFaint}>
          {isToday
            ? "No workouts yet — your latest sessions will show up here."
            : "No workouts on this day."}
        </Txt>
      ) : (
        listed.map((w, i) => (
          <View key={w.id}>
            {i > 0 ? <Divider /> : null}
            <WorkoutCard workout={w} onPress={() => setSelected(w)} />
          </View>
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

      {streakOpen ? (
        <StreakDialog
          streak={streak}
          workouts={workouts}
          userName={settings.name}
          onClose={() => setStreakOpen(false)}
        />
      ) : null}
    </View>
  );
}
