/** History tab — past workout sessions, newest first. Tap one to open the
 * full summary (sets, 1RMs, PR badges — same screen as after finishing). */
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { C } from "../theme";
import { Card, SectionTitle, Txt } from "../components/ui";
import { WorkoutCard } from "../components/WorkoutCard";
import { WorkoutSummary } from "../components/WorkoutSummary";
import { useStore } from "../lib/store";
import type { Workout } from "../types";

export function History() {
  const { workouts, deleteWorkout } = useStore();
  const [selected, setSelected] = useState<Workout | null>(null);
  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">History</Txt>
      <SectionTitle>{sorted.length} workouts</SectionTitle>

      {sorted.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>
            Nothing here yet — finish your first workout and it lands in the log.
          </Txt>
        </Card>
      ) : (
        sorted.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            onPress={() => setSelected(w)}
            onDelete={() => deleteWorkout(w.id)}
          />
        ))
      )}
    </ScrollView>

      {selected ? (
        <WorkoutSummary workout={selected} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  );
}
