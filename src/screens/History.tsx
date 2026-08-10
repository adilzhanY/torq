/**
 * History — THE TIMELINE (Adilzhan picked idea A from the lavish review
 * `.lavish/torq-history.html`, 2026-08-09).
 *
 * It used to be a wall of identical rows: every session rendered as the same
 * five-line inventory of "4 x Barbell Full Squat ... 90 kg", so a session
 * that set fifteen records looked exactly like three sets of bench. And it
 * was the last screen in the app still leading with VOLUME and CALORIES,
 * after both were cut from Home and Stats.
 *
 * Now a rail runs down the left with a node per session — LIME when it set a
 * record — and the empty days are NAMED between them. That last part is the
 * whole argument for the redesign: a log's second job is showing your
 * pattern, and "2 days off" says more about a training year than any
 * per-session number.
 *
 * The exercise inventory is gone from the row, replaced by what the session
 * actually did: records, points gained, muscles worked. The full detail is
 * one tap away in the summary, where it always was.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { C, R, TOP_BAR_SPACE } from "../theme";
import { Icon } from "../components/Icon";
import { PageTitle, Txt } from "../components/ui";
import { ConfirmModal } from "../components/CustomModal";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { useStore } from "../lib/store";
import { fmtDuration, prTotals } from "../lib/stats";
import { pointsPerWorkout } from "../lib/progress";
import { partLabel, workoutMuscles } from "../lib/muscles";
import { bodyProfileAt } from "../lib/calories";
import { workoutSets, type Workout } from "../types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86400000;
/** Distance from a node row's top edge to the centre of its dot. */
const DOT_MID = 25;

/** Local midnight — gaps are counted in calendar days, not 24-hour blocks. */
function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Newest-first workouts bucketed into month sections. */
function monthSections(sorted: Workout[]): { title: string; data: Workout[] }[] {
  const thisYear = new Date().getFullYear();
  const out: { key: string; title: string; data: Workout[] }[] = [];
  for (const w of sorted) {
    const d = new Date(w.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let s = out[out.length - 1];
    if (!s || s.key !== key) {
      s = {
        key,
        title:
          d.getFullYear() === thisYear
            ? MONTHS[d.getMonth()]
            : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        data: [],
      };
      out.push(s);
    }
    s.data.push(w);
  }
  return out;
}

function Chip({ text, tone }: { text: string; tone?: "gold" | "accent" }) {
  const [bg, fg] =
    tone === "gold"
      ? ["rgba(233,185,32,0.14)", C.gold]
      : tone === "accent"
        ? ["rgba(200,254,35,0.14)", C.accent]
        : [C.page2, C.inkSoft];
  return (
    <View style={{ backgroundColor: bg, borderRadius: R.sm, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Txt size={10.5} weight="bold" color={fg}>{text}</Txt>
    </View>
  );
}

/**
 * The rail segment every row draws for itself. `capTop`/`capBottom` stop it at
 * the dot instead of the row edge, so a month's first and last nodes end the
 * line rather than leaving it hanging into the whitespace.
 */
function Rail({ capTop, capBottom }: { capTop?: boolean; capBottom?: boolean }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 9,
        top: capTop ? DOT_MID : 0,
        ...(capBottom ? { height: capTop ? 0 : DOT_MID } : { bottom: 0 }),
        width: 2,
        backgroundColor: C.hair,
      }}
    />
  );
}

/**
 * One session on the rail.
 *
 * Each row draws its OWN slice of the rail rather than the list drawing one
 * long line: a virtualised list unmounts rows as they leave the screen, so a
 * single continuous rail would be cut wherever windowing decided. Stacked
 * segments are seamless and survive recycling.
 */
function Node({
  workout,
  prCount,
  points,
  muscles,
  gapDays,
  first,
  last,
  onPress,
  onDelete,
}: {
  workout: Workout;
  prCount: number;
  points: number;
  muscles: string[];
  /** Rest days between this session and the older one below it. */
  gapDays: number | null;
  /** First / last session of its month, so the rail can cap at the dot. */
  first: boolean;
  last: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const d = new Date(workout.startedAt);
  const when =
    `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ` +
    `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sets = workoutSets(workout);
  const meta = [
    workout.endedAt ? fmtDuration(workout.startedAt, workout.endedAt) : null,
    `${sets} set${sets === 1 ? "" : "s"}`,
    `${workout.entries.length} exercise${workout.entries.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasPr = prCount > 0;

  return (
    <View>
      <Pressable onPress={onPress}>
        <View style={{ paddingLeft: 30, paddingVertical: 12 }}>
          <Rail capTop={first} capBottom={last} />
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 19,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: hasPr ? C.accent : C.page,
              borderWidth: 2,
              borderColor: hasPr ? C.accent : C.inkFaint,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt size={10} weight="extrabold" color={C.inkFaint} style={{ letterSpacing: 1, flex: 1 }}>
              {when.toUpperCase()}
            </Txt>
            <Pressable hitSlop={10} onPress={onDelete}>
              <Icon name="Trash2" size={15} color={C.inkFaint} />
            </Pressable>
          </View>
          <Txt size={16} weight="extrabold" style={{ marginTop: 2 }} numberOfLines={1}>
            {workout.name}
          </Txt>
          <Txt size={11.5} color={C.inkFaint} style={{ marginTop: 2 }}>{meta}</Txt>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            {hasPr ? <Chip tone="gold" text={`${prCount} PR${prCount === 1 ? "" : "s"}`} /> : null}
            {points >= 1 ? <Chip tone="accent" text={`+${Math.round(points)} pts`} /> : null}
            {muscles.map((m) => (
              <Chip key={m} text={m} />
            ))}
          </View>
        </View>
      </Pressable>

      {gapDays != null && gapDays > 0 ? (
        <View style={{ paddingLeft: 30, paddingVertical: 7 }}>
          <Rail />
          <View
            style={{
              position: "absolute",
              left: 5,
              top: 11,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: C.page,
              borderWidth: 1.5,
              borderColor: C.line,
            }}
          />
          <Txt size={10.5} weight="bold" color={C.inkFaint} style={{ letterSpacing: 0.6 }}>
            {gapDays === 1 ? "1 day off" : `${gapDays} days off`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

export function History() {
  const { workouts, exercises, measurements, settings, deleteWorkout } = useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [confirming, setConfirming] = useState<Workout | null>(null);

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.startedAt - a.startedAt),
    [workouts],
  );
  const sections = useMemo(() => monthSections(sorted), [sorted]);

  // One chronological pass each, not one per row — see stats.prTotals.
  const prs = useMemo(() => prTotals(workouts), [workouts]);
  const bodyAt = useMemo(
    () => (ms: number) => {
      const p = bodyProfileAt(settings, measurements, ms);
      return { weightKg: p.weightKg, sex: p.sex };
    },
    [settings, measurements],
  );
  const pts = useMemo(
    () => pointsPerWorkout(workouts, settings.unit, bodyAt),
    [workouts, settings.unit, bodyAt],
  );

  /**
   * Rest days before each session, computed WITHIN a month only: a gap that
   * spanned a month boundary would render above the next month's header,
   * reading as if it belonged to the wrong month.
   */
  const gaps = useMemo(() => {
    const out = new Map<string, number>();
    for (const section of sections) {
      for (let i = 0; i < section.data.length - 1; i++) {
        const younger = dayStart(section.data[i].startedAt);
        const older = dayStart(section.data[i + 1].startedAt);
        const days = Math.round((younger - older) / DAY_MS) - 1;
        if (days > 0) out.set(section.data[i].id, days);
      }
    }
    return out;
  }, [sections]);

  const renderItem = useCallback(
    ({ item, index, section }: { item: Workout; index: number; section: { data: Workout[] } }) => (
      <Node
        workout={item}
        first={index === 0}
        last={index === section.data.length - 1}
        prCount={prs.get(item.id) ?? 0}
        points={pts.get(item.id) ?? 0}
        muscles={workoutMuscles(item, exercises).map(partLabel)}
        gapDays={gaps.get(item.id) ?? null}
        onPress={() => setSelected(item)}
        onDelete={() => setConfirming(item)}
      />
    ),
    [prs, pts, gaps, exercises],
  );

  return (
    <View style={{ flex: 1 }}>
      {/* VIRTUALISED: a plain ScrollView mounted every row at once and cost
          600 ms to open the tab. Keep the windowing props. */}
      <SectionList
        sections={sections}
        keyExtractor={(w) => w.id}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: TOP_BAR_SPACE + 16,
          paddingBottom: 120,
        }}
        ListHeaderComponent={<PageTitle style={{ marginBottom: 4 }}>History</PageTitle>}
        ListEmptyComponent={
          <Txt size={13} color={C.inkFaint}>
            Nothing here yet — finish your first workout and it lands in the log.
          </Txt>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginTop: 20,
              marginBottom: 2,
            }}
          >
            <Txt size={18} weight="extrabold">{section.title}</Txt>
            <Txt size={12} weight="bold" color={C.inkFaint}>
              {section.data.length} session{section.data.length === 1 ? "" : "s"}
            </Txt>
          </View>
        )}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />

      {confirming ? (
        <ConfirmModal
          title="Delete workout?"
          message={`"${confirming.name}" will be removed from your history. Records may change.`}
          onConfirm={() => deleteWorkout(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      ) : null}

      {selected ? (
        <WorkoutSummary workout={selected} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  );
}
