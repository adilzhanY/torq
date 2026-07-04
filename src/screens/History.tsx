/** History tab — past workout sessions, newest first. */
import { Pressable, ScrollView, View } from "react-native";
import { C } from "../theme";
import { Icon } from "../components/Icon";
import { Card, Divider, Pill, SectionTitle, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { workoutSets, workoutVolume } from "../types";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDuration(w: { startedAt: number; endedAt?: number }): string {
  if (!w.endedAt) return "";
  const min = Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
}

export function History() {
  const { workouts, exercises, deleteWorkout, settings } = useStore();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);

  return (
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
          <Card key={w.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt size={15} weight="bold">{w.name}</Txt>
              <Pressable hitSlop={8} onPress={() => deleteWorkout(w.id)}>
                <Icon name="Trash2" size={16} color={C.badAcc} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Pill text={fmtDate(w.startedAt)} color={C.inkSoft} bg={C.page2} />
              {w.endedAt ? <Pill text={fmtDuration(w)} color={C.inkSoft} bg={C.page2} /> : null}
              <Pill text={`${workoutSets(w)} sets`} color={C.goodAcc} bg={C.goodSurf} />
              <Pill
                text={`${Math.round(workoutVolume(w))} ${settings.unit}`}
                color={C.prAcc}
                bg={C.prSurf}
              />
            </View>
            <Divider />
            <View style={{ gap: 4 }}>
              {w.entries.map((e, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt size={13} weight="semibold" color={C.inkSoft}>
                    {e.sets.length} × {name(e.exerciseId)}
                  </Txt>
                  <Txt size={13} color={C.inkFaint}>
                    {Math.max(...e.sets.map((s) => s.weight), 0)} {settings.unit}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
