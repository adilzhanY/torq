/**
 * Post-workout summary (Strong's workout detail screen, Torq-themed):
 * auto-named title, long date, per-exercise cards with an estimated-1RM
 * column per set, trophy PR badges on record-setting sets, and a pinned
 * footer with duration / total volume / PR count. Shown right after
 * finishing a session and when tapping a History card. Full-screen inline
 * overlay, same pattern as ExercisePicker.
 */
import { useEffect, useMemo } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { C, R, SET_TYPE_META, clay } from "../theme";
import { Icon } from "./Icon";
import { SlideUp } from "./anim";
import { Card, Txt } from "./ui";
import { useStore } from "../lib/store";
import { computePRs, est1RM, fmtDuration, fmtLongDate } from "../lib/stats";
import { workoutVolume, type Workout } from "../types";

function PrPill({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: C.goodSurf,
        borderRadius: R.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Icon name="Trophy" size={12} color={C.goodAcc} />
      <Txt size={11} weight="extrabold" color={C.goodAcc}>{label}</Txt>
    </View>
  );
}

function FooterStat({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={icon} size={16} color={C.inkSoft} />
      <Txt size={14} weight="extrabold">{text}</Txt>
    </View>
  );
}

export function WorkoutSummary({
  workout,
  onClose,
  highlightExerciseId,
}: {
  workout: Workout;
  onClose: () => void;
  /** Rings this exercise's card in light green (deep-link from exercise info). */
  highlightExerciseId?: string;
}) {
  const { exercises, workouts, settings } = useStore();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const prs = useMemo(() => computePRs(workout, workouts), [workout, workouts]);

  return (
    <SlideUp
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.page,
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 190, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <Txt size={22} weight="extrabold" style={{ flex: 1 }}>{workout.name}</Txt>
        </View>
        <Txt size={13} weight="semibold" color={C.inkSoft}>
          {fmtLongDate(workout.startedAt)}
        </Txt>

        {workout.entries.map((entry, ei) => {
          let normalCount = 0;
          const highlighted = entry.exerciseId === highlightExerciseId;
          return (
            <Card
              key={`${entry.exerciseId}-${ei}`}
              style={{
                gap: 8,
                ...(highlighted
                  ? { borderWidth: 2, borderColor: "rgba(160,210,20,0.85)" }
                  : {}),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt size={15} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                  {name(entry.exerciseId)}
                </Txt>
                <Txt size={11} weight="bold" color={C.inkFaint}>1RM</Txt>
              </View>
              {entry.sets.map((set, si) => {
                if (set.type === "normal") normalCount += 1;
                const setPrs = prs.bySet.get(`${ei}-${si}`);
                return (
                  <View key={si} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {set.type === "normal" ? (
                        <Txt size={14} weight="bold" color={C.inkFaint} style={{ width: 24 }}>
                          {normalCount}
                        </Txt>
                      ) : (
                        <Txt
                          size={14}
                          weight="extrabold"
                          color={SET_TYPE_META[set.type].color}
                          style={{ width: 24 }}
                        >
                          {SET_TYPE_META[set.type].letter}
                        </Txt>
                      )}
                      <Txt size={14} weight="semibold" style={{ flex: 1 }}>
                        {set.weight} {settings.unit} × {set.reps}
                      </Txt>
                      <Txt size={14} weight="bold" color={C.inkSoft}>
                        {est1RM(set.weight, set.reps) || "—"}
                      </Txt>
                    </View>
                    {setPrs ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, paddingLeft: 34 }}>
                        {setPrs.rm ? <PrPill label="1RM" /> : null}
                        {setPrs.weight ? <PrPill label="Weight" /> : null}
                        {setPrs.vol ? <PrPill label="Vol." /> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          );
        })}
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: 100 }}>
        <View
          style={[
            {
              backgroundColor: C.surface,
              borderRadius: R.md,
              paddingHorizontal: 18,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
            clay(),
          ]}
        >
          <FooterStat
            icon="Clock"
            text={workout.endedAt ? fmtDuration(workout.startedAt, workout.endedAt) : "—"}
          />
          <FooterStat
            icon="Scale"
            text={`${Math.round(workoutVolume(workout))} ${settings.unit}`}
          />
          <FooterStat icon="Trophy" text={`${prs.total} PR${prs.total === 1 ? "" : "s"}`} />
        </View>
      </View>
    </SlideUp>
  );
}
