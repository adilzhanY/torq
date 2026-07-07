/** History-style workout card: name, stat pills, per-exercise max lines.
 * Used by the History tab and the exercise-info History tab. */
import { Pressable, View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { Card, Divider, Pill, Txt } from "./ui";
import { useStore } from "../lib/store";
import { fmtDuration } from "../lib/stats";
import { workoutSets, workoutVolume, type Workout } from "../types";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WorkoutCard({
  workout: w,
  onPress,
  onDelete,
}: {
  workout: Workout;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const { exercises, settings } = useStore();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={15} weight="bold">{w.name}</Txt>
          {onDelete ? (
            <Pressable hitSlop={8} onPress={onDelete}>
              <Icon name="Trash2" size={16} color={C.badAcc} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill text={fmtDate(w.startedAt)} color={C.inkSoft} bg={C.page2} />
          {w.endedAt ? (
            <Pill text={fmtDuration(w.startedAt, w.endedAt)} color={C.inkSoft} bg={C.page2} />
          ) : null}
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
    </Pressable>
  );
}
