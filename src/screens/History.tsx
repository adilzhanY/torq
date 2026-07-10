/** History tab — past workout sessions, newest first, grouped by month
 * (Strong-style: month name left, workout count right). Tap a card to open
 * the full summary (sets, 1RMs, PR badges — same screen as after
 * finishing). */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { C, TOP_BAR_SPACE } from "../theme";
import { Card, Txt } from "../components/ui";
import { ConfirmDialog } from "../components/Dialog";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { useStore } from "../lib/store";
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

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">History</Txt>

      {sorted.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>
            Nothing here yet — finish your first workout and it lands in the log.
          </Txt>
        </Card>
      ) : (
        monthSections(sorted).map((section) => (
          <View key={section.title} style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Txt size={18} weight="extrabold">{section.title}</Txt>
              <Txt size={12} weight="bold" color={C.inkFaint}>
                {section.workouts.length} workout{section.workouts.length === 1 ? "" : "s"}
              </Txt>
            </View>
            {section.workouts.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onPress={() => setSelected(w)}
                onDelete={() => setConfirming(w)}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>

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
