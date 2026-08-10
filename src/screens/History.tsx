/**
 * History: THE TIMELINE (Adilzhan picked idea A from the lavish review
 * `.lavish/torq-history.html`, 2026-08-09).
 *
 * It used to be a wall of identical rows: every session rendered as the same
 * five-line inventory of "4 x Barbell Full Squat ... 90 kg", so a session
 * that set fifteen records looked exactly like three sets of bench. And it
 * was the last screen in the app still leading with VOLUME and CALORIES,
 * after both were cut from Home and Stats.
 *
 * Now a rail runs down the left with a node per session (LIME when it set a
 * record) and the empty days are NAMED between them. That last part is the
 * whole argument for the redesign: a log's second job is showing your
 * pattern, and "2 days off" says more about a training year than any
 * per-session number.
 *
 * The exercise inventory is gone from the row, replaced by what the session
 * actually did: records, points gained, muscles worked. The full detail is
 * one tap away in the summary, where it always was.
 */
import { useCallback, useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { C, TOP_BAR_SPACE } from "../theme";
import { PageTitle, Txt } from "../components/ui";
import { ConfirmModal } from "../components/CustomModal";
import { WorkoutRow } from "../components/WorkoutRow";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { useStore } from "../lib/store";
import { prTotals } from "../lib/stats";
import { pointsPerWorkout } from "../lib/progress";
import { partLabel, workoutMuscles } from "../lib/muscles";
import { bodyProfileAt } from "../lib/calories";
import type { Workout } from "../types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_MS = 86400000;

/** Local midnight: gaps are counted in calendar days, not 24-hour blocks. */
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

export function History() {
  const { workouts, exercises, measurements, settings, deleteWorkout } = useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [confirming, setConfirming] = useState<Workout | null>(null);

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.startedAt - a.startedAt),
    [workouts],
  );
  const sections = useMemo(() => monthSections(sorted), [sorted]);

  // One chronological pass each, not one per row: see stats.prTotals.
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
      <WorkoutRow
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
            Nothing here yet: finish your first workout and it lands in the log.
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
