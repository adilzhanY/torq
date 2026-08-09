/**
 * History tab — past workout sessions, newest first, grouped by month
 * (Strong-style: month name left, workout count right). Tap a card to open
 * the full summary (sets, 1RMs, PR badges — same screen as after finishing).
 *
 * VIRTUALISED, and that is not premature: with a plain ScrollView this tab
 * mounted every card at once — 37 workouts × the six lucide icons a card
 * draws — and measured 600 ms to open against 40–90 ms for every other tab.
 * A SectionList renders a screenful and nothing more.
 */
import { useCallback, useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { C, TOP_BAR_SPACE } from "../theme";
import { Divider, PageTitle, Txt } from "../components/ui";
import { ConfirmDialog } from "../components/Dialog";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { useStore } from "../lib/store";
import { prTotals } from "../lib/stats";
import type { Workout } from "../types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Newest-first workouts bucketed into month sections. */
function monthSections(sorted: Workout[]): { title: string; workouts: Workout[] }[] {
  const thisYear = new Date().getFullYear();
  const sections: { key: string; title: string; workouts: Workout[] }[] = [];
  for (const w of sorted) {
    const d = new Date(w.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let s = sections[sections.length - 1];
    if (!s || s.key !== key) {
      s = {
        key,
        // Older years get the year spelled out ("July 2025").
        title: d.getFullYear() === thisYear ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        workouts: [],
      };
      sections.push(s);
    }
    s.workouts.push(w);
  }
  return sections;
}

export function History() {
  const { workouts, deleteWorkout } = useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const [confirming, setConfirming] = useState<Workout | null>(null);
  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);
  // One chronological pass for every card's PR badge.
  const prs = useMemo(() => prTotals(workouts), [workouts]);


  const sections = useMemo(
    () => monthSections(sorted).map((x) => ({ title: x.title, data: x.workouts })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Workout; index: number }) => (
      <View>
        {/* CARDLESS: entries are separated by hairlines, not boxes — and the
            hairline between two workouts is the ONLY rule on the page, since
            WorkoutCard stopped drawing its own. */}
        {index > 0 ? <Divider /> : null}
        <WorkoutCard
          workout={item}
          prCount={prs.get(item.id) ?? 0}
          onPress={() => setSelected(item)}
          onDelete={() => setConfirming(item)}
        />
      </View>
    ),
    [prs],
  );

  return (
    <View style={{ flex: 1 }}>
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
              marginTop: 18,
              marginBottom: 4,
            }}
          >
            <Txt size={18} weight="extrabold">{section.title}</Txt>
            <Txt size={12} weight="bold" color={C.inkFaint}>
              {section.data.length} workout{section.data.length === 1 ? "" : "s"}
            </Txt>
          </View>
        )}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />

      {confirming ? (
        <ConfirmDialog
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
