/** History-style workout card: name, date/duration on top, per-exercise
 * max lines, then sets · volume · calories stats with icons at the bottom.
 * Used by the History tab, Home recents, and the exercise-info History
 * tab. */
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { Card, Divider, Txt } from "./ui";
import { useStore } from "../lib/store";
import { bodyProfileAt, workoutCalories } from "../lib/calories";
import { computePRs, fmtDuration } from "../lib/stats";
import { workoutSets, workoutVolume, type Workout } from "../types";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "9:41" local, same style as the summary's long date line. */
function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function IconStat({
  icon,
  text,
  color = C.inkSoft,
}: {
  icon: string;
  text: string;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={icon} size={14} color={color} />
      <Txt size={12} weight="bold" color={color}>{text}</Txt>
    </View>
  );
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
  const { exercises, workouts, measurements, settings } = useStore();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const kcal = workoutCalories(
    w,
    exercises,
    bodyProfileAt(settings, measurements, w.startedAt),
    settings,
  );
  const prCount = useMemo(() => computePRs(w, workouts).total, [w, workouts]);
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

        {/* When + how long (completion time falls back to start for legacy rows) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <IconStat
            icon="CalendarDays"
            text={`${fmtDate(w.startedAt)} · ${fmtTime(w.endedAt ?? w.startedAt)}`}
          />
          {w.endedAt ? (
            <IconStat icon="Clock" text={fmtDuration(w.startedAt, w.endedAt)} />
          ) : null}
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
        <Divider />

        {/* The work itself: sets · volume · calories */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <IconStat
            icon="CheckCheck"
            text={`${workoutSets(w)} set${workoutSets(w) === 1 ? "" : "s"}`}
            color={C.goodAcc}
          />
          <IconStat
            icon="Scale"
            text={`${Math.round(workoutVolume(w))} ${settings.unit}`}
            color={C.prAcc}
          />
          {kcal > 0 ? <IconStat icon="Flame" text={`${kcal} kcal`} color={C.warnAcc} /> : null}
          {prCount > 0 ? (
            <IconStat icon="Trophy" text={`${prCount} PR${prCount === 1 ? "" : "s"}`} color={C.gold} />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
