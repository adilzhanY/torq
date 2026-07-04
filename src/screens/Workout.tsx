/**
 * Workout tab — Strong-style: start an empty session or launch a routine.
 * While a session is active, this tab is the live logger: sets with
 * weight × reps, tick to complete, finish/discard.
 */
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import { C, R, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import {
  Card,
  Divider,
  NumberField,
  Pill,
  PrimaryButton,
  SectionTitle,
  TextField,
  Txt,
} from "../components/ui";
import { Squish } from "../components/anim";
import { useStore } from "../lib/store";
import { workoutSets, workoutVolume, type WorkoutEntry } from "../types";

function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const { exercises } = useStore();
  const [q, setQ] = useState("");
  const list = exercises
    .filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(20,26,24,0.4)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: C.page,
            borderTopLeftRadius: R.lg,
            borderTopRightRadius: R.lg,
            padding: 16,
            maxHeight: "75%",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt size={17} weight="extrabold">Add exercise</Txt>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="X" size={20} color={C.inkSoft} />
            </Pressable>
          </View>
          <TextField value={q} onChange={setQ} placeholder="Search exercises…" />
          <FlatList
            data={list}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item.id);
                  onClose();
                }}
                style={{ paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <Txt weight="semibold">{item.name}</Txt>
                <Pill text={item.bodyPart} color={C.inkSoft} bg={C.page2} />
              </Pressable>
            )}
            ItemSeparatorComponent={Divider}
          />
        </View>
      </View>
    </Modal>
  );
}

function ActiveSession() {
  const { activeWorkout, exercises, updateActiveWorkout, finishWorkout, discardWorkout } = useStore();
  const [picker, setPicker] = useState(false);
  if (!activeWorkout) return null;
  const w = activeWorkout;
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";

  const setEntries = (entries: WorkoutEntry[]) => updateActiveWorkout({ entries });

  const patchSet = (ei: number, si: number, patch: Partial<WorkoutEntry["sets"][number]>) => {
    const entries = w.entries.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) },
    );
    setEntries(entries);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Txt size={20} weight="extrabold">{w.name}</Txt>
          <Txt size={12} color={C.inkFaint}>
            {workoutSets(w)} sets · {Math.round(workoutVolume(w))} volume
          </Txt>
        </View>
        <Pill text="LIVE" color={C.accentInk} bg={C.accent} />
      </View>

      {w.entries.map((entry, ei) => (
        <Card key={`${entry.exerciseId}-${ei}`} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt size={15} weight="bold">{name(entry.exerciseId)}</Txt>
            <Pressable
              hitSlop={8}
              onPress={() => setEntries(w.entries.filter((_, i) => i !== ei))}
            >
              <Icon name="Trash2" size={17} color={C.badAcc} />
            </Pressable>
          </View>
          {entry.sets.map((set, si) => (
            <View key={si} style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <Txt size={13} weight="bold" color={C.inkFaint} style={{ width: 24, marginBottom: 10 }}>
                {si + 1}
              </Txt>
              <NumberField
                label={si === 0 ? "Weight" : undefined}
                value={set.weight ? String(set.weight) : ""}
                onChange={(v) => patchSet(ei, si, { weight: Number(v) || 0 })}
                width={110}
              />
              <NumberField
                label={si === 0 ? "Reps" : undefined}
                value={set.reps ? String(set.reps) : ""}
                onChange={(v) => patchSet(ei, si, { reps: Number(v) || 0 })}
                width={90}
              />
              <Squish
                onPress={() => patchSet(ei, si, { done: !set.done })}
                style={[
                  {
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: set.done ? C.accent : C.page2,
                    marginBottom: 1,
                  },
                  claySm(),
                ]}
              >
                <Icon name="Check" size={18} color={set.done ? C.accentInk : C.inkFaint} />
              </Squish>
            </View>
          ))}
          <Pressable
            onPress={() => {
              const last = entry.sets[entry.sets.length - 1];
              const next = { type: "normal" as const, weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false };
              setEntries(w.entries.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, next] })));
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
          >
            <Icon name="Plus" size={16} color={C.inkSoft} />
            <Txt size={13} weight="bold" color={C.inkSoft}>Add set</Txt>
          </Pressable>
        </Card>
      ))}

      <PrimaryButton
        label="Add exercise"
        background={C.surface}
        color={C.primary}
        onPress={() => setPicker(true)}
      />
      <PrimaryButton
        label="Finish workout"
        background={C.accent}
        color={C.accentInk}
        onPress={finishWorkout}
        disabled={workoutSets(w) === 0}
      />
      <PrimaryButton label="Discard" background={C.badSurf} color={C.badAcc} onPress={discardWorkout} />

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(exerciseId) =>
          setEntries([
            ...w.entries,
            { exerciseId, sets: [{ type: "normal", weight: 0, reps: 0, done: false }] },
          ])
        }
      />
    </ScrollView>
  );
}

export function Workout() {
  const { activeWorkout, routines, startWorkout, deleteRoutine } = useStore();

  if (activeWorkout) return <ActiveSession />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">Start Workout</Txt>

      <Squish
        onPress={() => startWorkout()}
        style={[
          {
            backgroundColor: C.primary,
            borderRadius: R.md,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          },
          clay(),
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: C.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Play" size={20} color={C.accentInk} />
        </View>
        <View style={{ gap: 2 }}>
          <Txt size={16} weight="extrabold" color="#fff">Quick start</Txt>
          <Txt size={12} color="rgba(255,255,255,0.7)">Begin an empty workout</Txt>
        </View>
      </Squish>

      <SectionTitle>Routines</SectionTitle>
      {routines.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>
            No routines yet. Finish a workout and save it as a routine, or build one on the Exercises tab.
          </Txt>
        </Card>
      ) : (
        routines.map((r) => (
          <Card key={r.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt size={15} weight="bold">{r.name}</Txt>
              <Pressable hitSlop={8} onPress={() => deleteRoutine(r.id)}>
                <Icon name="Trash2" size={16} color={C.badAcc} />
              </Pressable>
            </View>
            <Txt size={12} color={C.inkFaint}>
              {r.entries.length} exercises
            </Txt>
            <PrimaryButton label="Start routine" onPress={() => startWorkout(r)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}
