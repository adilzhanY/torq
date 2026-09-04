/**
 * Home: "Today, full-bleed" (Adilzhan picked idea 1 from the lavish review
 * `.lavish/torq-home.html`, 2026-08-09).
 *
 * The problem the screenshots made obvious: a REST DAY and a TRAINING DAY
 * rendered as the same typographic block with a different noun (eyebrow,
 * headline, grey sentence), so you had to READ the page to learn what today
 * was. Home's whole job is that you shouldn't have to.
 *
 * So the day is now a PANEL that changes shape:
 *  - training → lime-framed, the session name, the muscles it hits, its
 *    length, and one big Start;
 *  - rest → a different object entirely: grey, moonlit, no primary CTA, and
 *    it spends its space on what is recovering and what lands next;
 *  - done / live / no-plan keep their own faces.
 *
 * Also gone, per the same review:
 *  - VOLUME, completely. It measured how much work you did, not how strong
 *    you got, and nobody was reading it.
 *  - The DateRuler. It cost ~90 px to repeat the date already in the header,
 *    and its tick marks said nothing about which days you train. The week
 *    strip below now carries that (with each day's SESSION TAG) and the
 *    calendar button still reaches any date.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { G, Path } from "react-native-svg";
import { C, R, TOP_BAR_SPACE, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { StreakCreature } from "../components/StreakCreature";
import { VORTEX_PATH } from "../components/Logo";
import { PopIn, Squish } from "../components/anim";
import { Divider, Eyebrow, PageTitle, Txt } from "../components/ui";
import { CalendarDialog } from "../components/CalendarDialog";
import { StreakDialog } from "../components/StreakDialog";
import { computeStreak, type Streak } from "../lib/streak";
import { addDays, dayStart } from "../components/DateRuler";
import { BADGE_ROW, RankBadge } from "../components/RankBadge";
import { WorkoutRow } from "../components/WorkoutRow";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { bodyProfileAt } from "../lib/calories";
import { DELOAD_FACTOR, deloadActive, fatigueCheck } from "../lib/deload";
import { prTotals } from "../lib/stats";
import { pointsPerWorkout } from "../lib/progress";
import { closestTierUp, overallRank, rankLifts, stageOf, tierLabel } from "../lib/rank";
import { routineMinutes, routineSets } from "../lib/plan";
import { partLabel, recovering, routineMuscles, sessionTag, workoutMuscles } from "../lib/muscles";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import type { Routine, Workout } from "../types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The streak, next to the date heading (2026-08-11, Adilzhan: "show the icon
 * in normal color, and number of days in white").
 *
 * NO PILL. The filled lime capsule forced its contents to go dark, which
 * meant the character lost its own colour and the count read as black text
 * in a blob. Bare on the page, the creature keeps the lime it was drawn in
 * and the number is plain white, which is also what the cardless system
 * wants: surfaces are for interactive things, and this is a label you can
 * tap, not a button.
 *
 * State is carried by the CREATURE's colour rather than a background: lime
 * when the streak is safe, amber one missed session from resetting, faint
 * when there is no streak at all. The number dims only when the streak is
 * dead, because a live count should never look disabled.
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
  const mark = streak.atRisk ? C.warnAcc : dead ? C.inkFaint : C.accent;
  return (
    <Squish
      onPress={onPress}
      // No background to grow, so the slop is what carries the tap target to
      // Android's 48 dp minimum.
      hitSlop={14}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      {/* The eyes go dark-on-lime as drawn, and follow the page when the
          creature is dimmed, so a faint streak does not stare. */}
      <StreakCreature size={19} color={mark} eye={dead ? C.page : "#0E0F0E"} />
      {/* Android pads a Text's line box above the glyphs, which pushed the
          count a fraction high next to the mark. */}
      <Txt
        size={17}
        weight="extrabold"
        color={dead ? C.inkFaint : C.ink}
        style={{ includeFontPadding: false }}
      >
        {streak.current}
      </Txt>
    </Squish>
  );
}

/** Monday 00:00 of the week containing `dayMs` (local). */
function weekStartOf(dayMs: number): number {
  const d = new Date(dayMs);
  return addDays(dayMs, -((d.getDay() + 6) % 7));
}

/** Small label above a hero panel's headline. */
function Kicker({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Txt size={10} weight="extrabold" color={color} style={{ letterSpacing: 1.6 }}>
      {children}
    </Txt>
  );
}

function Chip({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: dim ? C.page2 : "rgba(255,255,255,0.07)",
        borderRadius: R.sm,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Txt size={11} weight="bold" color={dim ? C.inkFaint : C.ink}>{text}</Txt>
    </View>
  );
}

/** The lime full-width CTA that ends a training panel. */
function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Squish
      onPress={onPress}
      style={{
        marginTop: 14,
        backgroundColor: C.accent,
        borderRadius: R.ctrl,
        paddingVertical: 13,
        alignItems: "center",
      }}
    >
      <Txt size={15} weight="extrabold" color={C.accentInk}>{label}</Txt>
    </Squish>
  );
}

function GhostCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Squish
      onPress={onPress}
      style={{
        marginTop: 14,
        borderRadius: R.ctrl,
        borderWidth: 1,
        borderColor: C.line,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      <Txt size={13} weight="bold" color={C.inkSoft}>{label}</Txt>
    </Squish>
  );
}

/**
 * The day, as a panel. Every state is a visibly different object. That is
 * the entire point of the redesign, so resist the urge to unify them back
 * into one block with a variable noun.
 */
/**
 * The vortex, huge and dimmed, bleeding off the panel's right edge, the
 * hero's watermark (Adilzhan asked for the shape he saw behind the training
 * card to be our logo).
 *
 * Three things make it read as texture rather than a second logo: it is
 * BIGGER than the panel (so no full silhouette is visible, only blades
 * cutting across), it sits at single-digit opacity, and it is cropped by the
 * panel's own radius. The parent needs `overflow: "hidden"`.
 *
 * It is only on the LIT faces of the hero. The rest-day panel spends its
 * space telling you what is recovering, and a brand mark behind that would
 * be decoration arguing with the one thing the panel is for.
 */
function HeroMark({ color = C.accent, opacity = 0.08 }: { color?: string; opacity?: number }) {
  const SIZE = 340;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        // Nearly half of it hangs off the edge on purpose: a whole vortex
        // sitting in the panel reads as a second logo competing with the
        // headline, where blades cutting in from the corner read as texture.
        right: -SIZE * 0.44,
        top: "50%",
        marginTop: -SIZE / 2,
        opacity,
      }}
    >
      <Svg width={SIZE} height={SIZE} viewBox="0 0 1024 1024">
        {/* potrace emits math-axis coords, so the mark is y-flipped here the
            same way Logo.tsx does it. */}
        <G transform="translate(0,1024) scale(0.1,-0.1)">
          <Path fill={color} d={VORTEX_PATH} />
        </G>
      </Svg>
    </View>
  );
}

function TodayHero({
  routine,
  done,
  nextUp,
  nextUpInDays,
}: {
  routine: Routine | null;
  done: boolean;
  nextUp: Routine | null;
  nextUpInDays: number;
}) {
  const { exercises, workouts, activeWorkout, settings, startWorkout } = useStore();
  const { setTab, openPlanWizard } = useUi();

  // ── live session ────────────────────────────────────────────────────────
  if (activeWorkout) {
    return (
      <Squish
        onPress={() => setTab("workout")}
        style={[
          {
            backgroundColor: C.accent,
            borderRadius: R.lg,
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
          <Txt size={16} weight="extrabold" color={C.accentInk}>Workout in progress</Txt>
          <Txt size={12} color="rgba(26,27,26,0.7)">Jump back into your session</Txt>
        </View>
      </Squish>
    );
  }

  // ── no plan ─────────────────────────────────────────────────────────────
  if (!settings.plan) {
    return (
      <View
        style={{
          borderRadius: R.lg,
          padding: 16,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
        }}
      >
        <Kicker color={C.inkSoft}>TRAINING PLAN</Kicker>
        <Txt size={26} weight="extrabold" style={{ marginTop: 4 }}>No plan yet</Txt>
        <Txt size={12.5} color={C.inkSoft} style={{ marginTop: 4 }}>
          A few questions and Torq plans your whole week.
        </Txt>
        <Cta label="Build my plan" onPress={openPlanWizard} />
      </View>
    );
  }

  // ── today's session finished ────────────────────────────────────────────
  if (routine && done) {
    return (
      <LinearGradient
        colors={["rgba(200,254,35,0.16)", "rgba(200,254,35,0.03)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: R.lg,
          padding: 16,
          borderWidth: 1,
          borderColor: "rgba(200,254,35,0.34)",
          overflow: "hidden",
        }}
      >
        <HeroMark opacity={0.07} />
        <Kicker color={C.accent}>DONE TODAY</Kicker>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Txt size={26} weight="extrabold">{routine.name}</Txt>
          <Icon name="Check" size={22} color={C.accent} strokeWidth={3} />
        </View>
        <Txt size={12.5} color={C.inkSoft} style={{ marginTop: 4 }}>
          Nice work. Recovery starts now.
        </Txt>
      </LinearGradient>
    );
  }

  // ── training day ────────────────────────────────────────────────────────
  if (routine) {
    const muscles = routineMuscles(routine, exercises);
    return (
      <LinearGradient
        colors={["rgba(200,254,35,0.14)", "rgba(200,254,35,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: R.lg,
          padding: 16,
          borderWidth: 1,
          borderColor: "rgba(200,254,35,0.38)",
          overflow: "hidden",
        }}
      >
        <HeroMark />
        <Kicker color={C.accent}>TRAINING DAY</Kicker>
        <Txt size={27} weight="extrabold" style={{ marginTop: 4 }}>{routine.name}</Txt>
        <Txt size={12.5} color={C.inkSoft} style={{ marginTop: 4 }}>
          {routine.entries.length} exercises · {routineSets(routine)} sets · about{" "}
          {routineMinutes(routine, settings.restSec)} min
        </Txt>
        {muscles.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {muscles.map((m) => (
              <Chip key={m} text={partLabel(m)} />
            ))}
          </View>
        ) : null}
        <Cta
          label={`Start ${routine.name}`}
          onPress={() => {
            startWorkout(routine);
            setTab("workout");
          }}
        />
      </LinearGradient>
    );
  }

  // ── rest day ────────────────────────────────────────────────────────────
  const resting = recovering(workouts, exercises, Date.now());
  const when =
    nextUpInDays === 1 ? "TOMORROW" : nextUp?.weekday != null ? DAYS[nextUp.weekday].toUpperCase() : "";
  const nextMuscles = nextUp ? routineMuscles(nextUp, exercises) : [];

  return (
    <View
      style={{
        borderRadius: R.lg,
        padding: 16,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="Moon" size={15} color={C.inkSoft} />
        <Kicker color={C.inkSoft}>REST DAY</Kicker>
      </View>
      <Txt size={26} weight="extrabold" color={C.inkSoft} style={{ marginTop: 4 }}>
        Recovering
      </Txt>
      <Txt size={12.5} color={C.inkFaint} style={{ marginTop: 4 }}>
        Nothing is due today.
      </Txt>

      {resting.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {resting.map((r) => (
            <Chip
              key={r.part}
              dim
              text={`${partLabel(r.part)} · ${r.days === 0 ? "today" : r.days === 1 ? "1 day" : `${r.days} days`}`}
            />
          ))}
        </View>
      ) : null}

      {nextUp ? (
        <Pressable onPress={() => setTab("workout")}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: C.hair,
            }}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Kicker color={C.inkFaint}>{when ? `NEXT UP · ${when}` : "NEXT UP"}</Kicker>
              <Txt size={15.5} weight="extrabold" style={{ marginTop: 2 }}>{nextUp.name}</Txt>
              {nextMuscles.length > 0 ? (
                <Txt size={11.5} color={C.inkFaint}>
                  {nextMuscles.map(partLabel).join(" · ")}
                </Txt>
              ) : null}
            </View>
            <Icon name="ChevronRight" size={16} color={C.inkFaint} />
          </View>
        </Pressable>
      ) : null}

      <GhostCta label="Train anyway" onPress={() => setTab("workout")} />
    </View>
  );
}

/** One of the three numbers under the week strip. */
function Tile({
  label,
  value,
  sub,
  subColor,
  progress,
  dots,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  /** 0..1, draws a meter under the value. */
  progress?: number;
  /** Seven booleans: draws the week's trained days instead of a meter. */
  dots?: boolean[];
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: R.md,
        padding: 11,
      }}
    >
      <Txt size={9} weight="extrabold" color={C.inkFaint} style={{ letterSpacing: 1.2 }}>
        {label}
      </Txt>
      <Txt size={22} weight="extrabold" style={{ marginTop: 3 }} numberOfLines={1}>{value}</Txt>
      {sub ? (
        <Txt size={10.5} color={subColor ?? C.inkSoft} numberOfLines={1}>{sub}</Txt>
      ) : null}
      {progress != null ? (
        <View
          style={{
            height: 5,
            borderRadius: R.pill,
            backgroundColor: C.page2,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <View
            style={{
              width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
              height: "100%",
              borderRadius: R.pill,
              backgroundColor: C.accent,
            }}
          />
        </View>
      ) : null}
      {dots ? (
        <View style={{ flexDirection: "row", gap: 3, marginTop: 8 }}>
          {dots.map((on, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: R.pill,
                backgroundColor: on ? C.accent : C.page2,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Home() {
  const { workouts, exercises, measurements, routines, settings, updateSettings } = useStore();
  const { setTab } = useUi();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [day, setDay] = useState(() => dayStart(Date.now()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);

  const now = Date.now();
  const today = dayStart(now);
  const isToday = day === today;
  const d = new Date(day);
  const heading = isToday ? DAYS[d.getDay()] : day === addDays(today, -1) ? "Yesterday" : DAYS[d.getDay()];
  const subtitle = `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  // ----- Hero data (always the real today) ----------------------------------
  const todaysRoutine = routines.find((r) => r.plan && r.weekday === new Date(today).getDay()) ?? null;
  const doneToday =
    !!todaysRoutine && workouts.some((w) => dayStart(w.startedAt) === today && w.routineId === todaysRoutine.id);
  const next = (() => {
    for (let i = 1; i <= 7; i++) {
      const wd = new Date(addDays(today, i)).getDay();
      const r = routines.find((x) => x.plan && x.weekday === wd);
      if (r) return { routine: r, inDays: i };
    }
    return { routine: null as Routine | null, inDays: 0 };
  })();

  // ----- Streak (plan-aware, see lib/streak.ts) -----------------------------
  const streak = useMemo(
    () => computeStreak(workouts, routines, now),
    // `now` moves every render but only by milliseconds; a streak is in days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, routines, today],
  );
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

  // ----- Week strip (week of the selected day, Monday-first) ---------------
  const weekStart = weekStartOf(day);
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const trainedDays = new Set(
    workouts
      .filter((w) => w.endedAt && w.startedAt >= weekStart && w.startedAt < weekEnd)
      .map((w) => dayStart(w.startedAt)),
  );
  const planRoutines = routines.filter((r) => r.plan);
  const routineForWeekday = new Map(planRoutines.map((r) => [r.weekday, r]));
  const weekDoneCount = weekDays.filter((x) => trainedDays.has(x)).length;
  const weekTarget = planRoutines.length || 3;

  // ----- Rank momentum (global, not day-scoped) ----------------------------
  const profile = bodyProfileAt(settings, measurements, now);
  // rankLifts walks every set in the history and used to run TWICE per
  // render here (once for now, once for the start of the week).
  const lifts = useMemo(
    () => rankLifts(workouts, settings.unit, profile.weightKg, profile.sex),
    [workouts, settings.unit, profile.weightKg, profile.sex],
  );
  const overall = useMemo(() => overallRank(lifts), [lifts]);
  const prevOverall = useMemo(
    () =>
      overallRank(
        rankLifts(
          workouts.filter((w) => w.endedAt && w.endedAt < weekStartOf(today)),
          settings.unit,
          profile.weightKg,
          profile.sex,
        ),
      ),
    [workouts, today, settings.unit, profile.weightKg, profile.sex],
  );
  const weekDelta = Math.round(overall.state.points - prevOverall.state.points);
  const tierUp = closestTierUp(lifts, profile.weightKg, profile.sex, settings.unit);
  const tierUpName = tierUp
    ? exercises.find((e) => e.id === tierUp.exerciseId)?.name ?? "a lift"
    : null;

  const dayFinished = workouts.filter((w) => dayStart(w.startedAt) === day);
  const recent = [...workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  const listed = isToday ? recent : [...dayFinished].sort((a, b) => b.startedAt - a.startedAt);

  // Fatigue: scans every lift's last three sessions, so memoise it.
  const fatigue = useMemo(() => fatigueCheck(workouts, exercises, now), [workouts, exercises, now]);
  const onDeload = deloadActive(settings.deloadUntil, now);

  // The timeline row's two numbers. ONE chronological pass each rather than
  // one per row, computing them per card is what made History cost 600 ms
  // to open before it was virtualised.
  const prs = useMemo(() => prTotals(workouts), [workouts]);
  const rowPoints = useMemo(
    () =>
      pointsPerWorkout(workouts, settings.unit, (ms) => {
        const b = bodyProfileAt(settings, measurements, ms);
        return { weightKg: b.weightKg, sex: b.sex };
      }),
    [workouts, settings, measurements],
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: TOP_BAR_SPACE + 16,
          paddingBottom: 120,
          gap: 14,
        }}
      >
        {/* Date header + calendar button */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <PopIn key={day} style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PageTitle>{heading}</PageTitle>
              {streak.hasPlan ? (
                /* Nudged down by half the title's descender depth.
                 * `alignItems: "center"` centres the pill on the text's BOX,
                 * which is measured from the cap top to the descender bottom;
                 * the eye centres on the word's INK instead, and every weekday
                 * name ends in "day", so there is always exactly one descender
                 * pulling the word's visual mass ~2.3 dp below the box centre.
                 * Without this the pill measures perfectly centred and still
                 * looks high, which is exactly what Adilzhan saw.
                 *
                 * A TRANSFORM, not a margin: `alignItems: "center"` centres the
                 * MARGIN box, so a marginTop of n only moves the pill n/2 and
                 * the number stops meaning what it says. */
                <View style={{ transform: [{ translateY: 2.3 }] }}>
                  <StreakPill
                    streak={streak}
                    todayPending={streakTodayPending}
                    onPress={() => setStreakOpen(true)}
                  />
                </View>
              ) : null}
            </View>
            <Txt size={13} weight="bold" color={C.inkFaint}>{subtitle}</Txt>
          </PopIn>
          <Squish
            onPress={() => setCalendarOpen(true)}
            style={[
              {
                width: 42,
                height: 42,
                borderRadius: R.ctrl,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.line,
                alignItems: "center",
                justifyContent: "center",
              },
              claySm(),
            ]}
          >
            <Icon name="CalendarDays" size={19} color={C.ink} />
          </Squish>
        </View>

        <TodayHero
          routine={todaysRoutine}
          done={doneToday}
          nextUp={next.routine}
          nextUpInDays={next.inDays}
        />

        {/* Week at a glance, now carrying each day's SESSION TAG, which is
            what the deleted date scrubber never told you. */}
        <View>
          <Eyebrow>
            {/* "4 of 3 done" read as a bug. Training MORE than the plan is a
                good thing, so once you pass the target it says so instead of
                printing an impossible fraction. */}
            {(isToday ? "This week" : "That week") +
              (weekDoneCount > weekTarget
                ? ` · ${weekDoneCount} done · ${weekDoneCount - weekTarget} above plan`
                : ` · ${weekDoneCount} of ${weekTarget} done`)}
          </Eyebrow>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {weekDays.map((cell) => {
              const wd = new Date(cell).getDay();
              const trained = trainedDays.has(cell);
              const isTodayCell = cell === today;
              const planned = routineForWeekday.get(wd);
              const tag = trained
                ? planned
                  ? sessionTag(planned, exercises)
                  : "DONE"
                : planned
                  ? sessionTag(planned, exercises)
                  : "-";
              return (
                <View key={cell} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                  <Txt size={9} weight="extrabold" color={C.inkFaint} style={{ letterSpacing: 0.4 }}>
                    {"MTWTFSS"[(wd + 6) % 7]}
                  </Txt>
                  <View
                    style={{
                      marginTop: 5,
                      width: "100%",
                      borderRadius: R.sm,
                      paddingVertical: 7,
                      alignItems: "center",
                      backgroundColor: trained
                        ? "rgba(200,254,35,0.16)"
                        : isTodayCell
                          ? "rgba(200,254,35,0.07)"
                          : C.page2,
                      borderWidth: 1,
                      borderColor: isTodayCell ? C.accent : "transparent",
                    }}
                  >
                    {trained ? (
                      <Icon name="Check" size={14} color={C.accent} strokeWidth={3} />
                    ) : (
                      <Txt
                        size={13}
                        weight="extrabold"
                        color={planned ? C.ink : C.inkFaint}
                      >
                        {new Date(cell).getDate()}
                      </Txt>
                    )}
                    <Txt
                      size={8}
                      weight="extrabold"
                      color={trained ? C.accent : C.inkFaint}
                      numberOfLines={1}
                      style={{ marginTop: 2, letterSpacing: 0.2 }}
                    >
                      {tag}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* FATIGUE CHECK: only when most tracked lifts have stopped moving,
            or while a deload week is running. Silence is the default, because
            a card that cries deload every week gets ignored forever. */}
        {onDeload ? (
          <View
            style={{
              borderRadius: R.lg,
              padding: 14,
              backgroundColor: C.page2,
              borderWidth: 1,
              borderColor: C.line,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="TrendingDown" size={17} color={C.warnAcc} />
            <View style={{ flex: 1 }}>
              <Txt size={14} weight="extrabold" color={C.warnAcc}>Deload week</Txt>
              <Txt size={12} color={C.inkSoft} style={{ marginTop: 1 }}>
                Sessions load at {Math.round(DELOAD_FACTOR * 100)}% until{" "}
                {new Date(settings.deloadUntil ?? 0).getDate()}{" "}
                {MONTHS_SHORT[new Date(settings.deloadUntil ?? 0).getMonth()]}. Ride it out.
              </Txt>
            </View>
            <Pressable hitSlop={8} onPress={() => updateSettings({ deloadUntil: undefined })}>
              <Txt size={12.5} weight="bold" color={C.inkFaint}>End</Txt>
            </Pressable>
          </View>
        ) : fatigue.recommend ? (
          <View
            style={{
              borderRadius: R.lg,
              padding: 14,
              backgroundColor: C.warnSurf,
              borderWidth: 1,
              borderColor: "rgba(240,167,66,0.35)",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="TriangleAlert" size={16} color={C.warnAcc} />
              <Txt size={14} weight="extrabold" color={C.warnAcc}>
                {fatigue.stalled.length} of {fatigue.tracked} lifts have stalled
              </Txt>
            </View>
            <Txt size={12.5} color={C.inkSoft}>
              {fatigue.stalled.slice(0, 3).join(", ")} stopped moving over their last three
              sessions. That is usually fatigue rather than effort. A week at{" "}
              {Math.round(DELOAD_FACTOR * 100)}% normally fixes it.
            </Txt>
            <Pressable
              onPress={() => updateSettings({ deloadUntil: Date.now() + 7 * 86400000 })}
              style={{
                alignSelf: "flex-start",
                backgroundColor: C.warnAcc,
                borderRadius: R.ctrl,
                paddingHorizontal: 14,
                paddingVertical: 8,
                marginTop: 2,
              }}
            >
              <Txt size={13} weight="extrabold" color={C.accentInk}>Take a deload week</Txt>
            </Pressable>
          </View>
        ) : null}

        {/* Where you stand, three numbers that actually move. */}
        {lifts.length > 0 ? (
          <View>
            <Eyebrow>Where you stand</Eyebrow>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Tile
                label="RANK"
                value={String(Math.round(overall.state.points))}
                sub={weekDelta > 0 ? `▲ +${weekDelta} this week` : tierLabel(overall.state)}
                subColor={weekDelta > 0 ? C.goodAcc : C.inkSoft}
                progress={overall.state.progress}
              />
              <Tile
                label="STREAK"
                value={String(streak.current)}
                sub={streak.longest > 0 ? `best ${streak.longest}` : "days"}
                dots={weekDays.map((x) => trainedDays.has(x))}
              />
              {tierUp && tierUpName ? (
                <Tile
                  label={`TO ${tierUp.next.toUpperCase()}`}
                  value={tierUp.toGo < 10 ? tierUp.toGo.toFixed(1) : String(Math.ceil(tierUp.toGo))}
                  sub={`${settings.unit} · ${tierUpName.split(" ").slice(-1)[0]}`}
                  progress={
                    lifts.find((l) => l.exerciseId === tierUp.exerciseId)?.tier.progress ?? 0
                  }
                />
              ) : (
                <Tile
                  label="TIER"
                  value={overall.state.tier}
                  sub={tierLabel(overall.state)}
                  progress={overall.state.progress}
                />
              )}
            </View>
          </View>
        ) : null}

        {/* Rank shield + the lift closest to a promotion. */}
        {lifts.length > 0 ? (
          <Pressable onPress={() => setTab("ranks")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
              <RankBadge
                tier={overall.state.tier}
                stage={stageOf(overall.state.progress)}
                size={BADGE_ROW}
              />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt size={14} weight="extrabold">{tierLabel(overall.state)}</Txt>
                <Txt size={11.5} color={C.inkFaint}>
                  {overall.state.next
                    ? `${Math.ceil(overall.state.toNext)} pts to ${overall.state.next}`
                    : "Top of the ladder"}
                </Txt>
              </View>
              <Icon name="ChevronRight" size={17} color={C.inkFaint} />
            </View>
          </Pressable>
        ) : null}

        {/* Recents. "See all" survives as a second door into History. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 18,
          }}
        >
          <Eyebrow style={{ marginTop: 0, marginBottom: 0 }}>
            {isToday ? "Recent workouts" : `Workouts · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`}
          </Eyebrow>
          <Pressable
            hitSlop={8}
            onPress={() => setTab("history")}
            style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
          >
            <Txt size={12} weight="bold" color={C.accent}>See all</Txt>
            <Icon name="ChevronRight" size={14} color={C.accent} />
          </Pressable>
        </View>
        {listed.length === 0 ? (
          <Txt size={13} color={C.inkFaint}>
            {isToday
              ? "No workouts yet, your latest sessions will show up here."
              : "No workouts on this day."}
          </Txt>
        ) : (
          /* One wrapper, because the ScrollView sets `gap: 14` on its
             children and that gap would cut the rail between every row. */
          <View>
            {listed.map((w, i) => (
              <WorkoutRow
                key={w.id}
                workout={w}
                prCount={prs.get(w.id) ?? 0}
                points={rowPoints.get(w.id) ?? 0}
                muscles={workoutMuscles(w, exercises).map(partLabel)}
                first={i === 0}
                last={i === listed.length - 1}
                onPress={() => setSelected(w)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {selected ? (
        <WorkoutSummary workout={selected} onClose={() => setSelected(null)} />
      ) : null}

      {calendarOpen ? (
        <CalendarDialog date={day} onPick={setDay} onClose={() => setCalendarOpen(false)} />
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
