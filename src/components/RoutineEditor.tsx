/**
 * Routine editor (Workout tab → routine ⋯ → Edit): full-screen inline
 * overlay listing the template's exercises with editable sets (weight ×
 * reps, add/remove), an exercise ⋯ menu (Replace exercise via the picker
 * in single-swap mode / Remove exercise), and an "Add exercises" footer
 * (multi-select picker, new entries default to 3 × 10). Back cancels;
 * the lime Save button commits via saveRoutine (plan/weekday fields are
 * preserved by the store).
 */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { C, R, TOP_BAR_SPACE, claySm } from "../theme";
import { Icon } from "./Icon";
import { SlideUp, Squish } from "./anim";
import { Card, NumberField, Txt } from "./ui";
import { CenterDialog, MenuRow } from "./Dialog";
import { ExercisePicker } from "./ExercisePicker";
import { useStore } from "../lib/store";
import type { Routine, WorkoutEntry } from "../types";

/** Deep-copied entries so edits never touch the stored routine. */
function cloneEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
  return entries.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
}

export function RoutineEditor({
  routine,
  onClose,
}: {
  routine: Routine;
  onClose: () => void;
}) {
  const { exercises, settings, saveRoutine } = useStore();
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const [entries, setEntries] = useState<WorkoutEntry[]>(() => cloneEntries(routine.entries));
  const [picker, setPicker] = useState(false);
  /** Entry index being replaced via the picker; null = picker appends. */
  const [replacing, setReplacing] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const patchEntry = (ei: number, next: WorkoutEntry) =>
    setEntries(entries.map((e, i) => (i === ei ? next : e)));

  const patchSet = (ei: number, si: number, patch: Partial<WorkoutEntry["sets"][number]>) => {
    const e = entries[ei];
    patchEntry(ei, {
      ...e,
      sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    });
  };

  const save = () => {
    saveRoutine(
      routine.name,
      entries.filter((e) => e.sets.length > 0),
      routine.id,
    );
    onClose();
  };

  const onPicked = (ids: string[]) => {
    if (replacing != null && ids.length > 0) {
      // Swap the exercise, keep its set scheme.
      patchEntry(replacing, { ...entries[replacing], exerciseId: ids[0] });
      setReplacing(null);
      return;
    }
    setEntries([
      ...entries,
      ...ids.map((exerciseId) => ({
        exerciseId,
        sets: Array.from({ length: 3 }, () => ({
          type: "normal" as const,
          weight: 0,
          reps: 10,
          done: false,
        })),
      })),
    ]);
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
      {/* Fixed header (clears the floating top bar). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: TOP_BAR_SPACE + 12,
          paddingBottom: 10,
        }}
      >
        <Pressable hitSlop={8} onPress={onClose}>
          <Icon name="ChevronLeft" size={24} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1, gap: 1 }}>
          <Txt size={11} weight="bold" color={C.inkFaint}>EDIT ROUTINE</Txt>
          <Txt size={18} weight="extrabold" numberOfLines={1}>{routine.name}</Txt>
        </View>
        <Squish
          onPress={save}
          style={[
            {
              backgroundColor: C.accent,
              borderRadius: R.pill,
              paddingHorizontal: 18,
              paddingVertical: 9,
            },
            claySm(),
          ]}
        >
          <Txt size={13} weight="extrabold" color={C.accentInk}>Save</Txt>
        </Squish>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
        {entries.map((entry, ei) => (
          <Card key={`${entry.exerciseId}-${ei}`} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Txt size={15} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                {name(entry.exerciseId)}
              </Txt>
              <Pressable hitSlop={8} onPress={() => setMenuFor(ei)}>
                <Icon name="Ellipsis" size={20} color={C.inkSoft} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Txt size={11} weight="bold" color={C.inkFaint} style={{ width: 40 }}>SET</Txt>
              <Txt size={11} weight="bold" color={C.inkFaint} style={{ width: 64 }}>
                {settings.unit.toUpperCase()}
              </Txt>
              <Txt size={11} weight="bold" color={C.inkFaint} style={{ width: 64 }}>REPS</Txt>
            </View>
            {entry.sets.map((set, si) => (
              <View key={si} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Txt size={14} weight="bold" color={C.inkFaint} style={{ width: 40 }}>
                  {si + 1}
                </Txt>
                <NumberField
                  value={set.weight ? String(set.weight) : ""}
                  onChange={(v) => patchSet(ei, si, { weight: Number(v) || 0 })}
                  width={64}
                  compact
                  center
                />
                <NumberField
                  value={set.reps ? String(set.reps) : ""}
                  onChange={(v) => patchSet(ei, si, { reps: Number(v) || 0 })}
                  width={64}
                  compact
                  center
                />
                <View style={{ flex: 1 }} />
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    patchEntry(ei, { ...entry, sets: entry.sets.filter((_, i) => i !== si) })
                  }
                >
                  <Icon name="X" size={16} color={C.inkFaint} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() =>
                patchEntry(ei, {
                  ...entry,
                  sets: [
                    ...entry.sets,
                    { ...(entry.sets[entry.sets.length - 1] ?? { type: "normal" as const, weight: 0, reps: 10 }), done: false },
                  ],
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 }}
            >
              <Icon name="Plus" size={14} color={C.inkSoft} />
              <Txt size={13} weight="bold" color={C.inkSoft}>Add set</Txt>
            </Pressable>
          </Card>
        ))}

        <Squish
          onPress={() => {
            setReplacing(null);
            setPicker(true);
          }}
          style={[
            {
              backgroundColor: C.surface,
              borderRadius: R.md,
              paddingVertical: 14,
              alignItems: "center",
            },
            claySm(),
          ]}
        >
          <Txt size={14} weight="bold">Add exercises</Txt>
        </Squish>
      </ScrollView>

      {menuFor != null ? (
        <CenterDialog onClose={() => setMenuFor(null)}>
          <Txt size={18} weight="extrabold" numberOfLines={1}>
            {name(entries[menuFor].exerciseId)}
          </Txt>
          <View>
            <MenuRow
              icon="Repeat"
              label="Replace exercise"
              onPress={() => {
                setReplacing(menuFor);
                setMenuFor(null);
                setPicker(true);
              }}
            />
            <MenuRow
              icon="X"
              label="Remove exercise"
              color={C.badAcc}
              onPress={() => {
                setEntries(entries.filter((_, i) => i !== menuFor));
                setMenuFor(null);
              }}
            />
          </View>
        </CenterDialog>
      ) : null}

      <ExercisePicker
        open={picker}
        onClose={() => {
          setPicker(false);
          setReplacing(null);
        }}
        onAdd={onPicked}
      />
    </SlideUp>
  );
}
