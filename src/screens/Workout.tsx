/**
 * Workout tab — Strong-style: start an empty session or launch a routine.
 * While a session is active, this tab is the live logger: sets with
 * weight × reps, tick to complete, finish/discard.
 */
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { Image } from "expo-image";
import { C, R, SET_TYPE_META, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { DB_BY_ID, DB_GIF_BY_ID, titleCase } from "../lib/exercisedb";
import { RECOMMENDED, type RecommendedRoutine } from "../lib/recommended";
import { lastSetsFor } from "../lib/stats";
import { ExercisePicker } from "../components/ExercisePicker";
import {
  Card,
  NumberField,
  Pill,
  PrimaryButton,
  SectionTitle,
  Txt,
} from "../components/ui";
import { PopIn, SlideUp, Squish } from "../components/anim";
import { useStore } from "../lib/store";
import {
  workoutSets,
  workoutVolume,
  type Workout as WorkoutModel,
  type WorkoutEntry,
  type WorkoutSet,
} from "../types";
import { WorkoutSummary } from "../components/WorkoutSummary";

/** 95 → "1:35", 3675 → "1:01:15". */
function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Re-render every second while `active` (drives elapsed + rest timers). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Width of the KG / REPS value fields in the live set logger. */
const FIELD_W = 50;

/**
 * KG / REPS cell: an input while the set is open; once the set is done it
 * collapses to a plain centered number that turns back into a focused
 * input when tapped, so completed sets stay editable.
 */
function SetNumInput({
  value,
  done,
  onChange,
  inputRef,
}: {
  value: string;
  done: boolean;
  onChange: (v: string) => void;
  inputRef?: (r: TextInput | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!done) setEditing(false);
  }, [done]);
  if (done && !editing) {
    return (
      <Pressable
        onPress={() => setEditing(true)}
        hitSlop={4}
        style={{ width: FIELD_W, paddingVertical: 7, alignItems: "center" }}
      >
        <Txt size={14} weight="bold">{value || "0"}</Txt>
      </Pressable>
    );
  }
  return (
    <NumberField
      ref={inputRef}
      value={value}
      onChange={onChange}
      width={FIELD_W}
      compact
      center
      autoFocus={done && editing}
      selectTextOnFocus={done}
      onBlur={() => setEditing(false)}
    />
  );
}

/**
 * Strong-style rest countdown: a tall bar that starts full and drains to
 * the left in one continuous animation, remaining time centered on top.
 * Freezes while paused. Tap to open the rest control pad.
 */
function RestCountdownBar({
  endsAt,
  seconds,
  remaining,
  paused,
  onPress,
}: {
  endsAt: number;
  seconds: number;
  remaining: number;
  paused: boolean;
  onPress: () => void;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (paused) {
      fill.stopAnimation();
      fill.setValue(Math.min(1, (remaining * 1000) / (seconds * 1000)));
      return;
    }
    const msLeft = Math.max(0, endsAt - Date.now());
    fill.setValue(Math.min(1, msLeft / (seconds * 1000)));
    Animated.timing(fill, {
      toValue: 0,
      duration: msLeft,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    // `remaining` is only the frozen value while paused; live runs key off endsAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, seconds, paused, fill]);

  return (
    <PopIn>
      <Pressable onPress={onPress}>
        <View
          style={{
            height: 40,
            borderRadius: R.sm,
            backgroundColor: C.page2,
            overflow: "hidden",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              backgroundColor: C.accent,
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {paused ? <Icon name="Pause" size={14} color={C.accentInk} /> : null}
            <Txt size={16} weight="extrabold" color={C.accentInk}>{fmtClock(remaining)}</Txt>
          </View>
        </View>
      </Pressable>
    </PopIn>
  );
}

/**
 * The line under each set: a faint divider labelled with that set's rest
 * (2:00) that becomes the draining countdown bar while the rest runs.
 * Tapping the idle divider pops open an inline editor (current seconds
 * preselected, number pad) to change the rest for this one set.
 */
function RestDivider({
  seconds,
  remaining,
  endsAt,
  paused,
  onPressBar,
  onChangeSeconds,
  editNonce,
}: {
  seconds: number;
  remaining?: number;
  endsAt?: number;
  paused?: boolean;
  onPressBar: () => void;
  onChangeSeconds: (sec: number) => void;
  /** Bumped externally (rest pad's RESET) to pop the editor open. */
  editNonce?: number;
}) {
  const [editing, setEditing] = useState(false);
  /** Raw digit buffer for the m:ss masked input, e.g. "230" -> 2:30. */
  const [draft, setDraft] = useState("");
  /** False until the first keystroke — the prefilled value shows "selected". */
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const secsToDigits = (sec: number) => {
    const s = Math.max(0, Math.min(599, Math.round(sec)));
    return `${Math.floor(s / 60)}${String(s % 60).padStart(2, "0")}`;
  };

  const openEditor = () => {
    setDraft(secsToDigits(seconds));
    setTouched(false);
    setEditing(true);
  };

  useEffect(() => {
    if (editNonce) openEditor();
    // Only fire on the nonce bump, not on unrelated seconds changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editNonce]);

  /** ATM-style right-to-left entry: digits push in from the right
   * (2 -> 0:02 -> 0:20 -> 2:00); once all 3 slots are filled, new digits
   * shift the seconds only, keeping the minute (2:00 + 3 -> 2:03). */
  const onDigits = (t: string) => {
    let d = t.replace(/\D/g, "");
    if (d.length > 3) d = d[0] + d.slice(-2);
    d = d.replace(/^0+(?=\d)/, "");
    setDraft(d);
    setTouched(true);
  };

  const commit = () => {
    if (touched) {
      const p = draft.padStart(3, "0");
      const sec = Number(p[0]) * 60 + Number(p.slice(1));
      if (sec >= 5) onChangeSeconds(Math.min(599, sec));
    }
    setEditing(false);
  };

  if (remaining != null && endsAt != null) {
    return (
      <RestCountdownBar
        endsAt={endsAt}
        seconds={seconds}
        remaining={remaining}
        paused={paused ?? false}
        onPress={onPressBar}
      />
    );
  }

  if (editing) {
    const p = draft.padStart(3, "0");
    const shown = `${Number(p[0])}:${p.slice(1)}`;
    return (
      <PopIn style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon name="Timer" size={14} color={C.inkSoft} />
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{
            backgroundColor: C.page2,
            borderRadius: R.pill,
            paddingHorizontal: 16,
            paddingVertical: 5,
          }}
        >
          <Txt
            size={15}
            weight="extrabold"
            style={{ backgroundColor: touched ? "transparent" : "rgba(200,254,35,0.55)" }}
          >
            {shown}
          </Txt>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onDigits}
            autoFocus
            selectTextOnFocus
            caretHidden
            selectionColor="transparent"
            keyboardType="number-pad"
            onBlur={commit}
            onSubmitEditing={commit}
            returnKeyType="done"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.02,
              color: "transparent",
              padding: 0,
            }}
          />
        </Pressable>
        <Txt size={11} weight="bold" color={C.inkFaint}>rest</Txt>
      </PopIn>
    );
  }

  return (
    <Pressable
      hitSlop={6}
      onPress={openEditor}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28 }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: "rgba(20,26,24,0.08)" }} />
      <Txt size={11} weight="bold" color={C.inkFaint}>{fmtClock(seconds)}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: "rgba(20,26,24,0.08)" }} />
    </Pressable>
  );
}

function ActiveSession({ onFinished }: { onFinished: (w: WorkoutModel) => void }) {
  const {
    activeWorkout,
    exercises,
    workouts,
    settings,
    updateActiveWorkout,
    finishWorkout,
    discardWorkout,
  } = useStore();
  const [picker, setPicker] = useState(false);
  /** Running rest countdown, keyed by "entryIndex-setIndex". While paused,
   * `pausedMs` holds the frozen remainder and `endsAt` is ignored. */
  const [rest, setRest] = useState<{
    key: string;
    endsAt: number;
    paused: boolean;
    pausedMs: number;
  } | null>(null);
  /** Rest control pad (opened by tapping the running bar). */
  const [pad, setPad] = useState(false);
  /** Bumped to pop a specific set's rest editor open (pad's RESET). */
  const [editReq, setEditReq] = useState<{ key: string; n: number } | null>(null);
  /** Which set's type menu is open + where to anchor it (touch position). */
  const [typeMenu, setTypeMenu] = useState<{ ei: number; si: number; x: number; y: number } | null>(null);
  const weightRefs = useRef<Record<string, TextInput | null>>({});
  const now = useNow(!!activeWorkout);

  // Buzz and clear when the rest countdown runs out.
  useEffect(() => {
    if (rest && !rest.paused && now >= rest.endsAt) {
      Vibration.vibrate(600);
      setRest(null);
      setPad(false);
    }
  }, [now, rest]);

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

  /** Sets from the most recent finished workout containing this exercise
   * (finished workouts only keep done sets). Null on a first-time exercise. */
  const prevSetsFor = (exerciseId: string): WorkoutSet[] | null => {
    let best: { at: number; sets: WorkoutSet[] } | null = null;
    for (const past of workouts) {
      const entry = past.entries.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
      if (entry && (!best || past.startedAt > best.at)) {
        best = { at: past.startedAt, sets: entry.sets };
      }
    }
    return best?.sets ?? null;
  };

  const restFor = (set: WorkoutSet) => set.restSec ?? settings.restSec;

  const toggleDone = (ei: number, si: number, set: WorkoutSet) => {
    const done = !set.done;
    patchSet(ei, si, { done });
    const key = `${ei}-${si}`;
    if (done) {
      setRest({ key, endsAt: Date.now() + restFor(set) * 1000, paused: false, pausedMs: 0 });
    } else if (rest?.key === key) {
      setRest(null);
      setPad(false);
    }
  };

  /** Add/subtract seconds on the running (or paused) rest. Hitting zero ends it. */
  const bumpRest = (deltaSec: number) => {
    setRest((r) => {
      if (!r) return r;
      if (r.paused) {
        const pausedMs = r.pausedMs + deltaSec * 1000;
        if (pausedMs <= 0) {
          setPad(false);
          return null;
        }
        return { ...r, pausedMs };
      }
      const endsAt = r.endsAt + deltaSec * 1000;
      if (endsAt <= Date.now()) {
        setPad(false);
        return null;
      }
      return { ...r, endsAt };
    });
  };

  const togglePauseRest = () => {
    setRest((r) => {
      if (!r) return r;
      return r.paused
        ? { ...r, paused: false, endsAt: Date.now() + r.pausedMs }
        : { ...r, paused: true, pausedMs: Math.max(0, r.endsAt - Date.now()) };
    });
  };

  /** Skip the rest and drop the keyboard into the next set's weight field. */
  const skipRest = () => {
    if (rest) {
      const [ei, si] = rest.key.split("-").map(Number);
      const entry = w.entries[ei];
      const nextKey =
        entry && si + 1 < entry.sets.length
          ? `${ei}-${si + 1}`
          : w.entries[ei + 1]
            ? `${ei + 1}-0`
            : null;
      if (nextKey) {
        // Let the pad modal close before grabbing focus.
        setTimeout(() => weightRefs.current[nextKey]?.focus(), 300);
      }
    }
    setRest(null);
    setPad(false);
  };

  /** Stop the rest and reopen that set's inline seconds editor. */
  const resetRest = () => {
    if (rest) setEditReq((p) => ({ key: rest.key, n: (p?.n ?? 0) + 1 }));
    setRest(null);
    setPad(false);
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Txt size={20} weight="extrabold">{w.name}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="Timer" size={13} color={C.inkSoft} />
            <Txt size={13} weight="extrabold" color={C.inkSoft}>
              {fmtClock((now - w.startedAt) / 1000)}
            </Txt>
            <Txt size={12} color={C.inkFaint}>
              · {workoutSets(w)} sets · {Math.round(workoutVolume(w))} volume
            </Txt>
          </View>
        </View>
        <Pill text="LIVE" color={C.accentInk} bg={C.accent} />
      </View>

      {w.entries.map((entry, ei) => {
        const prevSets = prevSetsFor(entry.exerciseId);
        return (
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Txt size={11} weight="bold" color={C.inkFaint} style={{ width: 28 }}>SET</Txt>
            <Txt size={11} weight="bold" color={C.inkFaint} style={{ flex: 1 }}>
              {prevSets ? "PREVIOUS" : ""}
            </Txt>
            <Txt
              size={11}
              weight="bold"
              color={C.inkFaint}
              style={{ width: FIELD_W, textAlign: "center" }}
            >
              {settings.unit.toUpperCase()}
            </Txt>
            <Txt
              size={11}
              weight="bold"
              color={C.inkFaint}
              style={{ width: FIELD_W, textAlign: "center" }}
            >
              REPS
            </Txt>
            <View style={{ width: 32, alignItems: "center" }}>
              <Icon name="Check" size={14} color={C.inkFaint} />
            </View>
          </View>
          {entry.sets.map((set, si) => {
            const prev = prevSets?.[si];
            const restKey = `${ei}-${si}`;
            return (
            <View key={si} style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginHorizontal: -16,
                  paddingHorizontal: 16,
                  paddingVertical: 3,
                  backgroundColor: set.done ? "rgba(160,210,20,0.42)" : "transparent",
                }}
              >
                <Pressable
                  hitSlop={6}
                  onPress={(e) =>
                    setTypeMenu({ ei, si, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })
                  }
                  style={{ width: 28 }}
                >
                  {set.type === "normal" ? (
                    <Txt size={14} weight="bold" color={C.inkFaint}>
                      {entry.sets.slice(0, si + 1).filter((s) => s.type === "normal").length}
                    </Txt>
                  ) : (
                    <Txt size={14} weight="extrabold" color={SET_TYPE_META[set.type].color}>
                      {SET_TYPE_META[set.type].letter}
                    </Txt>
                  )}
                </Pressable>
                <Txt size={12} weight="semibold" color={C.inkFaint} style={{ flex: 1 }} numberOfLines={1}>
                  {prevSets ? (prev ? `${prev.weight} ${settings.unit} × ${prev.reps}` : "—") : ""}
                </Txt>
                <SetNumInput
                  value={set.weight ? String(set.weight) : ""}
                  done={set.done}
                  onChange={(v) => patchSet(ei, si, { weight: Number(v) || 0 })}
                  inputRef={(r) => {
                    weightRefs.current[restKey] = r;
                  }}
                />
                <SetNumInput
                  value={set.reps ? String(set.reps) : ""}
                  done={set.done}
                  onChange={(v) => patchSet(ei, si, { reps: Number(v) || 0 })}
                />
                <Squish
                  onPress={() => toggleDone(ei, si, set)}
                  style={[
                    {
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: set.done ? C.accent : C.page2,
                    },
                    claySm(),
                  ]}
                >
                  <Icon name="Check" size={16} color={set.done ? C.accentInk : C.inkFaint} />
                </Squish>
              </View>
              <RestDivider
                seconds={restFor(set)}
                remaining={
                  rest?.key === restKey
                    ? Math.ceil((rest.paused ? rest.pausedMs : rest.endsAt - now) / 1000)
                    : undefined
                }
                endsAt={rest?.key === restKey ? rest.endsAt : undefined}
                paused={rest?.key === restKey ? rest.paused : false}
                onPressBar={() => setPad((p) => !p)}
                onChangeSeconds={(sec) => patchSet(ei, si, { restSec: sec })}
                editNonce={editReq?.key === restKey ? editReq.n : 0}
              />
            </View>
            );
          })}
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
        );
      })}

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
        onPress={() => {
          const finished = finishWorkout();
          if (finished) onFinished(finished);
        }}
        disabled={workoutSets(w) === 0}
      />
      <PrimaryButton label="Discard" background={C.badSurf} color={C.badAcc} onPress={discardWorkout} />

      <Modal
        visible={typeMenu !== null}
        transparent
        animationType="none"
        onRequestClose={() => setTypeMenu(null)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setTypeMenu(null)}>
          {typeMenu ? (
            <PopIn
              style={{
                position: "absolute",
                left: Math.max(
                  12,
                  Math.min(typeMenu.x - 10, Dimensions.get("window").width - 190 - 12),
                ),
                // Flip above the touch point when too close to the bottom.
                top:
                  typeMenu.y + 170 > Dimensions.get("window").height
                    ? typeMenu.y - 178
                    : typeMenu.y + 10,
                width: 190,
              }}
            >
              <View style={[{ backgroundColor: C.surface, borderRadius: R.md, padding: 4 }, clay()]}>
                {(Object.keys(SET_TYPE_META) as (keyof typeof SET_TYPE_META)[]).map((t) => {
                  const meta = SET_TYPE_META[t];
                  const cur = w.entries[typeMenu.ei]?.sets[typeMenu.si]?.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        patchSet(typeMenu.ei, typeMenu.si, { type: cur ? "normal" : t });
                        setTypeMenu(null);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11 }}
                    >
                      <Txt size={15} weight="extrabold" color={meta.color} style={{ width: 20 }}>
                        {meta.letter}
                      </Txt>
                      <Txt size={13} weight="semibold" style={{ flex: 1 }}>{meta.label}</Txt>
                      {cur ? <Icon name="Check" size={15} color={C.inkSoft} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </PopIn>
          ) : null}
        </Pressable>
      </Modal>

    </ScrollView>

      {pad && rest !== null ? (
        <SlideUp style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <View
            style={[
              {
                backgroundColor: C.primary,
                borderTopLeftRadius: R.lg,
                borderTopRightRadius: R.lg,
                padding: 14,
                paddingBottom: 96,
                gap: 10,
              },
              clay(),
            ]}
          >
            <Squish
              onPress={togglePauseRest}
              style={{
                height: 72,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt size={24} weight="extrabold" color="#fff">
                {rest?.paused ? "Resume" : "Pause"}
              </Txt>
            </Squish>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Squish
                onPress={() => bumpRest(20)}
                style={{
                  width: 64,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Plus" size={22} color="#fff" />
              </Squish>
              <Squish
                onPress={() => bumpRest(-20)}
                style={{
                  width: 64,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Minus" size={22} color="#fff" />
              </Squish>
              <View style={{ flex: 1 }}>
                <Squish
                  onPress={skipRest}
                  style={{
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: C.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={14} weight="extrabold" color={C.accentInk} style={{ letterSpacing: 1 }}>
                    SKIP
                  </Txt>
                </Squish>
              </View>
              <View style={{ flex: 1 }}>
                <Squish
                  onPress={resetRest}
                  style={{
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: C.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={14} weight="extrabold" color={C.accentInk} style={{ letterSpacing: 1 }}>
                    RESET
                  </Txt>
                </Squish>
              </View>
            </View>
          </View>
        </SlideUp>
      ) : null}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={(ids) =>
          setEntries([
            ...w.entries,
            ...ids.map((exerciseId) => ({
              exerciseId,
              // Replay last time's sets (prefilled weights/reps, warmups kept)
              // for a known exercise; a single empty set for a first-timer.
              sets: lastSetsFor(exerciseId, workouts) ?? [
                { type: "normal" as const, weight: 0, reps: 0, done: false },
              ],
            })),
          ])
        }
      />
    </View>
  );
}

function RecommendedCard({ routine }: { routine: RecommendedRoutine }) {
  const { startRecommended } = useStore();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Txt size={15} weight="bold">{routine.name}</Txt>
        <Txt size={12} color={C.inkFaint}>{routine.blurb}</Txt>
      </View>
      <View style={{ gap: 6 }}>
        {routine.items.map((item) => {
          const ex = DB_BY_ID[item.dbId];
          if (!ex) return null;
          return (
            <View key={item.dbId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Image
                source={{ uri: DB_GIF_BY_ID[item.dbId] }}
                style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#fff" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <Txt size={13} weight="bold" color={C.inkSoft} style={{ width: 44 }}>
                {item.sets}×{item.reps}
              </Txt>
              <Txt size={13} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                {titleCase(ex.name)}
              </Txt>
            </View>
          );
        })}
      </View>
      <PrimaryButton label="Start routine" onPress={() => startRecommended(routine)} />
    </Card>
  );
}

export function Workout() {
  const { activeWorkout, routines, startWorkout, deleteRoutine } = useStore();
  /** The just-finished session, shown as the post-workout summary. */
  const [summary, setSummary] = useState<WorkoutModel | null>(null);

  if (activeWorkout) return <ActiveSession onFinished={setSummary} />;

  return (
    <View style={{ flex: 1 }}>
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
            No routines yet. Start with a recommended one below — finishing it
            keeps its exercises in your library.
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

      <SectionTitle>Recommended</SectionTitle>
      {RECOMMENDED.map((r) => (
        <RecommendedCard key={r.name} routine={r} />
      ))}
    </ScrollView>

      {summary ? (
        <WorkoutSummary workout={summary} onClose={() => setSummary(null)} />
      ) : null}
    </View>
  );
}
