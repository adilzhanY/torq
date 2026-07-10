/**
 * Post-workout summary (Strong's workout detail screen, Torq-themed):
 * auto-named title, long date, ALL exercises in one card (compact sections
 * split by dividers — separate cards ate too much vertical space) with an
 * estimated-1RM column per set, trophy PR badges on record-setting sets,
 * and a duration / volume / calories / PR-count stats bar above the
 * exercises (was a floating footer; it covered the navbar area). The
 * header's ⋯ button opens a CenterDialog menu: Repeat workout (disabled
 * while a session is live), Save as routine, Share workout (system sheet),
 * Delete workout (ConfirmDialog). Shown right after finishing a session and
 * when tapping a History card. Full-screen inline overlay, same pattern as
 * ExercisePicker.
 */
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, Share, View } from "react-native";
import { C, R, SET_TYPE_META, TOP_BAR_SPACE, clay } from "../theme";
import { Icon } from "./Icon";
import { SlideUp } from "./anim";
import { Card, Divider, Txt } from "./ui";
import { CenterDialog, ConfirmDialog, MenuRow } from "./Dialog";
import { useStore } from "../lib/store";
import { useUi } from "../lib/ui";
import { bodyProfileAt, workoutCalories } from "../lib/calories";
import { computePRs, est1RM, fmtDuration, fmtLongDate } from "../lib/stats";
import { workoutSets, workoutVolume, type Workout, type WorkoutEntry } from "../types";

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

function StatItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={icon} size={15} color={C.inkSoft} />
      <Txt size={13} weight="extrabold">{text}</Txt>
    </View>
  );
}

/** Entries ready to be replayed: every set unticked. */
function freshEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
  return entries.map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({ ...s, done: false })),
  }));
}

export function WorkoutSummary({
  workout,
  onClose,
  highlightExerciseId,
}: {
  workout: Workout;
  onClose: () => void;
  /** Tints this exercise's section light green (deep-link from exercise info). */
  highlightExerciseId?: string;
}) {
  const {
    exercises,
    workouts,
    measurements,
    settings,
    activeWorkout,
    startWorkout,
    saveRoutine,
    deleteWorkout,
  } = useStore();
  const { setTab } = useUi();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const prs = useMemo(() => computePRs(workout, workouts), [workout, workouts]);
  const kcal = useMemo(
    () =>
      workoutCalories(
        workout,
        exercises,
        bodyProfileAt(settings, measurements, workout.startedAt),
        settings,
      ),
    [workout, exercises, settings, measurements],
  );

  const share = () => {
    const stats = [
      workout.endedAt ? fmtDuration(workout.startedAt, workout.endedAt) : null,
      `${workoutSets(workout)} sets`,
      `${Math.round(workoutVolume(workout))} ${settings.unit}`,
      kcal > 0 ? `${kcal} kcal` : null,
    ].filter(Boolean).join(" · ");
    const lines = workout.entries.map((e) => {
      const top = Math.max(...e.sets.map((s) => s.weight), 0);
      return `${e.sets.length} × ${name(e.exerciseId)} — ${top} ${settings.unit}`;
    });
    void Share.share({
      message: `${workout.name}\n${fmtLongDate(workout.startedAt)}\n${stats}\n\n${lines.join("\n")}`,
    });
  };

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
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <Txt size={22} weight="extrabold" style={{ flex: 1 }}>{workout.name}</Txt>
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <Icon name="Ellipsis" size={22} color={C.ink} />
          </Pressable>
        </View>
        <Txt size={13} weight="semibold" color={C.inkSoft}>
          {fmtLongDate(workout.startedAt)}
        </Txt>

        <View
          style={[
            {
              backgroundColor: C.surface,
              borderRadius: R.md,
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
            clay(),
          ]}
        >
          <StatItem
            icon="Clock"
            text={workout.endedAt ? fmtDuration(workout.startedAt, workout.endedAt) : "—"}
          />
          <StatItem
            icon="Scale"
            text={`${Math.round(workoutVolume(workout))} ${settings.unit}`}
          />
          <StatItem icon="Flame" text={`${kcal} kcal`} />
          <StatItem icon="Trophy" text={`${prs.total} PR${prs.total === 1 ? "" : "s"}`} />
        </View>

        <Card style={{ gap: 8 }}>
          {workout.entries.map((entry, ei) => {
            let normalCount = 0;
            const highlighted = entry.exerciseId === highlightExerciseId;
            return (
              <View key={`${entry.exerciseId}-${ei}`}>
                {ei > 0 ? <Divider /> : null}
                <View
                  style={{
                    gap: 8,
                    ...(ei > 0 ? { marginTop: 8 } : {}),
                    ...(highlighted
                      ? {
                          backgroundColor: "rgba(160,210,20,0.14)",
                          borderRadius: 12,
                          marginHorizontal: -8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                        }
                      : {}),
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Txt size={15} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                      {name(entry.exerciseId)}
                    </Txt>
                    {ei === 0 ? (
                      <Txt size={11} weight="bold" color={C.inkFaint}>1RM</Txt>
                    ) : null}
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
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>

      {menuOpen ? (
        <CenterDialog onClose={() => setMenuOpen(false)}>
          <Txt size={18} weight="extrabold">{workout.name}</Txt>
          <View>
            <MenuRow
              icon="Repeat"
              label={activeWorkout ? "Repeat workout (session in progress)" : "Repeat workout"}
              disabled={!!activeWorkout}
              onPress={() => {
                startWorkout({
                  id: workout.routineId ?? "",
                  name: workout.name,
                  entries: freshEntries(workout.entries),
                  updatedAt: 0,
                });
                setMenuOpen(false);
                onClose();
                setTab("workout");
              }}
            />
            <MenuRow
              icon="ListPlus"
              label="Save as routine"
              onPress={() => {
                saveRoutine(workout.name, freshEntries(workout.entries));
                setMenuOpen(false);
              }}
            />
            <MenuRow
              icon="Share2"
              label="Share workout"
              onPress={() => {
                setMenuOpen(false);
                share();
              }}
            />
            <MenuRow
              icon="Trash2"
              label="Delete workout"
              color={C.badAcc}
              onPress={() => {
                setMenuOpen(false);
                setConfirmingDelete(true);
              }}
            />
          </View>
        </CenterDialog>
      ) : null}

      {confirmingDelete ? (
        <ConfirmDialog
          title="Delete workout?"
          message={`"${workout.name}" and its ${workoutSets(workout)} sets will be removed from your history.`}
          onConfirm={() => {
            deleteWorkout(workout.id);
            onClose();
          }}
          onClose={() => setConfirmingDelete(false)}
        />
      ) : null}
    </SlideUp>
  );
}
