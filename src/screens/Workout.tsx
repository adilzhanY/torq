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
  Share,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { C, R, SET_TYPE_META, TOP_BAR_SPACE, clay, claySm } from "../theme";
import { Icon } from "../components/Icon";
import { DB_BY_ID, DB_GIF_BY_ID, titleCase } from "../lib/exercisedb";
import { RECOMMENDED, type RecommendedRoutine } from "../lib/recommended";
import { computePRs, lastSetsFor } from "../lib/stats";
import { targetRepsOf } from "../lib/suggest";
import { ExercisePicker } from "../components/ExercisePicker";
import { ExerciseInfo } from "../components/ExerciseInfo";
import { RoutineEditor } from "../components/RoutineEditor";
import {
  Card,
  Divider,
  Eyebrow,
  NumberField,
  Pill,
  PrimaryButton,
  TextField,
  Txt,
} from "../components/ui";
import { GrowIn, PopIn, SlideUp, Squish } from "../components/anim";
import { CenterDialog, ConfirmDialog, MenuRow } from "../components/Dialog";
import { useStore } from "../lib/store";
import { countdown, play, resetCountdown } from "../lib/sounds";
import {
  workoutSets,
  workoutVolume,
  type FocusMetric,
  type Routine,
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
const FIELD_W = 54;

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
        style={{
          width: FIELD_W,
          // Same box metrics as NumberField(compact) so ticking a set
          // doesn't jump the row height.
          paddingVertical: 5,
          alignItems: "center",
          backgroundColor: C.page2,
          borderRadius: R.sm,
          borderWidth: 1,
          borderColor: C.line,
        }}
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
      // Prefilled values (suggestions, replays) select on tap so typing
      // replaces them instead of appending digits.
      selectTextOnFocus
      onBlur={() => setEditing(false)}
    />
  );
}

/** Height of the running rest bar (sharp-10 live-session look). */
const BAR_H = 30;

/** The centered "1:24" (with a pause glyph when frozen), drawn twice by
 *  RestCountdownBar — once lime on the track, once dark inside the fill. */
function RestLabel({
  remaining,
  paused,
  color,
}: {
  remaining: number;
  paused: boolean;
  color: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {paused ? <Icon name="Pause" size={13} color={color} /> : null}
      <Txt size={15} weight="extrabold" color={color}>{fmtClock(remaining)}</Txt>
    </View>
  );
}

/**
 * Strong-style rest countdown: a bar that starts full and drains to the
 * left in one continuous animation, remaining time centered on it — dark
 * over the lime fill, lime over the spent track. Freezes while paused.
 * Tap to open the rest control pad.
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
  /** Measured bar width — the clipped label copy needs it to stay centered
   *  on the WHOLE bar while its own container shrinks with the fill. */
  const [barW, setBarW] = useState(0);
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
          onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
          style={{
            height: BAR_H,
            borderRadius: R.ctrl,
            backgroundColor: C.restTrack,
            overflow: "hidden",
            justifyContent: "center",
          }}
        >
          {/* Label on the empty track: lime on dark. */}
          <RestLabel remaining={remaining} paused={paused} color={C.accent} />
          {/* The draining lime fill, with the SAME label clipped inside it so
              the digits flip to dark exactly where the fill ends. */}
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              overflow: "hidden",
              backgroundColor: C.accent,
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
            }}
          >
            <View style={{ width: barW, height: "100%" }}>
              <RestLabel remaining={remaining} paused={paused} color={C.accentInk} />
            </View>
          </Animated.View>
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
            borderRadius: R.sm,
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
      // Slim fixed-height strip — the space between set rows is exactly this.
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 28,
        height: 12,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: C.hair }} />
      <Txt size={10} weight="bold" color={C.inkFaint}>{fmtClock(seconds)}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: C.hair }} />
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
  /** Exercise id whose info page (About/History/Records) is open. */
  const [info, setInfo] = useState<string | null>(null);
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
  /** Per-exercise header menus, anchored at the pressed button's pageY. */
  const [metricMenu, setMetricMenu] = useState<{ ei: number; y: number } | null>(null);
  const [dotsMenu, setDotsMenu] = useState<{ ei: number; y: number } | null>(null);
  /** Entry index pending delete confirmation. */
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  /** "ei-si" keys of sets added via Add set this render lifetime — only
   * those mount with the GrowIn entrance (restored/prefilled rows don't). */
  const grownSets = useRef<Set<string>>(new Set());
  const weightRefs = useRef<Record<string, TextInput | null>>({});
  const now = useNow(!!activeWorkout);

  // Count 3-2-1 out loud, then buzz + "go" when the rest runs out.
  useEffect(() => {
    if (!rest || rest.paused) return;
    if (now >= rest.endsAt) {
      Vibration.vibrate(600);
      play("restGo");
      resetCountdown();
      setRest(null);
      setPad(false);
      return;
    }
    countdown(Math.ceil((rest.endsAt - now) / 1000));
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

  const patchEntry = (ei: number, patch: Partial<WorkoutEntry>) =>
    setEntries(w.entries.map((e, i) => (i !== ei ? e : { ...e, ...patch })));

  /** Live focus-metric values for one exercise: completed sets only (same
   * rule as the header's live sets/volume), compared against the most
   * recent finished workout with this exercise for the increase. */
  const metricsFor = (entry: WorkoutEntry) => {
    let vol = 0;
    let reps = 0;
    let top: WorkoutSet | null = null;
    for (const s of entry.sets) {
      if (!s.done) continue;
      vol += s.weight * s.reps;
      reps += s.reps;
      if (!top || s.weight > top.weight) top = s;
    }
    const prev = prevSetsFor(entry.exerciseId);
    const prevVol = prev ? prev.reduce((s, x) => s + x.weight * x.reps, 0) : 0;
    // Stays +0% until something is logged — a fresh exercise isn't "-100%".
    const pct = prevVol > 0 && vol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : 0;
    const u = settings.unit;
    return {
      volume: `${Math.round(vol)} ${u}`,
      volumeIncrease: `${pct >= 0 ? "+" : ""}${pct}%`,
      reps: `${reps} reps`,
      weightReps: top ? `${top.weight} ${u} × ${top.reps}` : `0 ${u}`,
    } satisfies Record<FocusMetric, string>;
  };

  const toggleDone = (ei: number, si: number, set: WorkoutSet) => {
    const done = !set.done;
    patchSet(ei, si, { done });
    const key = `${ei}-${si}`;
    if (done) {
      play("setDone");
      resetCountdown();
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 140, gap: 14 }}>
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
        <Card key={`${entry.exerciseId}-${ei}`} style={{ gap: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              hitSlop={6}
              onPress={() => setInfo(entry.exerciseId)}
              style={{ flex: 1, alignItems: "flex-start" }}
            >
              <Txt size={18} weight="extrabold" color={C.ink} numberOfLines={1}>
                {name(entry.exerciseId)}
              </Txt>
            </Pressable>
            {/* Focus metric pill: Waypoints until a metric is picked, then
                its live value. Opens the Set a Focus Metric dialog. */}
            <Pressable
              hitSlop={6}
              onPress={(e) => {
                const ne = e.nativeEvent;
                setMetricMenu({ ei, y: ne.pageY - ne.locationY });
              }}
              style={{
                backgroundColor: C.page2,
                borderRadius: R.sm,
                paddingHorizontal: 10,
                paddingVertical: 5,
                minHeight: 26,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {entry.focusMetric ? (
                <Txt size={12} weight="extrabold" color={C.inkSoft}>
                  {metricsFor(entry)[entry.focusMetric]}
                </Txt>
              ) : (
                <Icon name="Waypoints" size={15} color={C.inkSoft} />
              )}
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                const ne = e.nativeEvent;
                setDotsMenu({ ei, y: ne.pageY - ne.locationY });
              }}
            >
              <Icon name="Ellipsis" size={20} color={C.inkSoft} />
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              marginBottom: 3,
            }}
          >
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
            const Wrap = grownSets.current.has(restKey) ? GrowIn : View;
            return (
            <Wrap key={si}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginHorizontal: -16,
                  paddingHorizontal: 16,
                  paddingVertical: 1,
                  backgroundColor: set.done ? "rgba(200,254,35,0.10)" : "transparent",
                }}
              >
                <Pressable
                  hitSlop={6}
                  onPress={(e) => {
                    // Anchor the menu to the number itself, not the finger:
                    // page − location = the pressable's top-left on screen.
                    const ne = e.nativeEvent;
                    setTypeMenu({
                      ei,
                      si,
                      x: ne.pageX - ne.locationX,
                      y: ne.pageY - ne.locationY,
                    });
                  }}
                  style={{ width: 28 }}
                >
                  {set.type === "normal" ? (
                    /* A done set's number turns lime — the row's completion
                       marker in the sharp-10 mock. */
                    <Txt size={14} weight="bold" color={set.done ? C.accent : C.inkFaint}>
                      {entry.sets.slice(0, si + 1).filter((s) => s.type === "normal").length}
                    </Txt>
                  ) : (
                    <Txt size={14} weight="extrabold" color={SET_TYPE_META[set.type].color}>
                      {SET_TYPE_META[set.type].letter}
                    </Txt>
                  )}
                </Pressable>
                <Txt size={12.5} weight="semibold" color={C.inkSoft} style={{ flex: 1 }} numberOfLines={1}>
                  {prevSets ? (prev ? `${prev.weight} ${settings.unit} × ${prev.reps}` : "—") : ""}
                </Txt>
                <View>
                  <SetNumInput
                    value={set.weight ? String(set.weight) : ""}
                    done={set.done}
                    onChange={(v) =>
                      // Editing the weight makes it the user's number, not
                      // the engine's — drop the suggestion badge.
                      patchSet(ei, si, { weight: Number(v) || 0, suggested: undefined })
                    }
                    inputRef={(r) => {
                      weightRefs.current[restKey] = r;
                    }}
                  />
                  {set.suggested && !set.done ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -5,
                        backgroundColor: set.suggested === "up" ? C.goodSurf : C.warnSurf,
                        borderRadius: 7,
                        padding: 2,
                      }}
                    >
                      <Icon
                        name={set.suggested === "up" ? "TrendingUp" : "TrendingDown"}
                        size={9}
                        color={set.suggested === "up" ? C.goodAcc : C.warnAcc}
                        strokeWidth={3}
                      />
                    </View>
                  ) : null}
                </View>
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
                      borderRadius: R.ctrl,
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
              {/* A done set's rest is history — show its divider only while
                  the countdown is actually running. Idle timers appear under
                  unfinished sets only. */}
              {set.done && rest?.key !== restKey ? null : (
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
              )}
            </Wrap>
            );
          })}
          <Pressable
            onPress={() => {
              const last = entry.sets[entry.sets.length - 1];
              const next = { type: "normal" as const, weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false };
              grownSets.current.add(`${ei}-${entry.sets.length}`);
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
        color={C.ink}
        onPress={() => setPicker(true)}
      />
      <PrimaryButton
        label="Finish workout"
        large
        background={C.accent}
        color={C.accentInk}
        onPress={() => {
          const finished = finishWorkout();
          if (finished) {
            // A session that set records earns the brighter flourish.
            play(computePRs(finished, workouts).total > 0 ? "pr" : "workoutDone");
            onFinished(finished);
          }
        }}
        disabled={workoutSets(w) === 0}
      />
      <PrimaryButton label="Discard" background={C.badSurf} color={C.badAcc} onPress={discardWorkout} />

      <Modal
        visible={typeMenu !== null}
        transparent
        // Align the modal window with the edge-to-edge app window: without
        // this it starts below the status bar and every pageY-anchored
        // position lands ~a status bar too low.
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setTypeMenu(null)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setTypeMenu(null)}>
          {typeMenu ? (
            <PopIn
              style={{
                position: "absolute",
                // −16 (menu padding 4 + item padding 12) lines the W/D/F
                // letter column up exactly under the set number.
                left: Math.max(
                  12,
                  Math.min(typeMenu.x - 16, Dimensions.get("window").width - 190 - 12),
                ),
                // Just under the number's row; flip above it when too close
                // to the bottom (menu is ~132 tall).
                top:
                  typeMenu.y + 26 + 140 > Dimensions.get("window").height
                    ? typeMenu.y - 140
                    : typeMenu.y + 26,
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

      {/* Set a Focus Metric — anchored under the exercise's metric pill. */}
      <Modal
        visible={metricMenu !== null}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setMetricMenu(null)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setMetricMenu(null)}>
          {metricMenu && w.entries[metricMenu.ei] ? (
            <PopIn
              style={{
                position: "absolute",
                right: 16,
                top:
                  metricMenu.y + 32 + 244 > Dimensions.get("window").height
                    ? metricMenu.y - 250
                    : metricMenu.y + 32,
                width: 280,
              }}
            >
              <View style={[{ backgroundColor: C.surface, borderRadius: R.md, padding: 6 }, clay()]}>
                <Txt size={15} weight="extrabold" style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                  Set a Focus Metric
                </Txt>
                {(
                  [
                    { key: "volume", label: "Total Volume" },
                    { key: "volumeIncrease", label: "Volume Increase" },
                    { key: "reps", label: "Total Reps" },
                    { key: "weightReps", label: "Weight/Reps" },
                  ] as { key: FocusMetric; label: string }[]
                ).map((m) => {
                  const entry = w.entries[metricMenu.ei];
                  const cur = entry.focusMetric === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => {
                        // Re-picking the active metric clears the pill,
                        // same revert pattern as the set-type menu.
                        patchEntry(metricMenu.ei, { focusMetric: cur ? undefined : m.key });
                        setMetricMenu(null);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 11,
                      }}
                    >
                      <Txt size={14} weight="semibold" style={{ flex: 1 }}>
                        {m.label}
                      </Txt>
                      <Txt size={14} weight="bold" color={C.inkSoft}>
                        {metricsFor(entry)[m.key]}
                      </Txt>
                      {cur ? <Icon name="Check" size={15} color={C.inkSoft} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </PopIn>
          ) : null}
        </Pressable>
      </Modal>

      {/* Exercise ⋯ menu — Strong's list; only Remove exercise acts yet. */}
      <Modal
        visible={dotsMenu !== null}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setDotsMenu(null)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setDotsMenu(null)}>
          {dotsMenu ? (
            <PopIn
              style={{
                position: "absolute",
                right: 16,
                top:
                  dotsMenu.y + 28 + 396 > Dimensions.get("window").height
                    ? Math.max(12, dotsMenu.y - 402)
                    : dotsMenu.y + 28,
                width: 250,
              }}
            >
              <View style={[{ backgroundColor: C.surface, borderRadius: R.md, padding: 6 }, clay()]}>
                {(
                  [
                    { icon: "FileText", label: "Add note" },
                    { icon: "Pin", label: "Add sticky note" },
                    { icon: "Diff", label: "Add warm-up sets" },
                    { icon: "Timer", label: "Update rest timers" },
                    { icon: "Undo2", label: "Replace exercise", divider: true },
                    { icon: "List", label: "Create superset" },
                    { icon: "SlidersVertical", label: "Preferences", divider: true },
                    { icon: "X", label: "Remove exercise", divider: true, danger: true },
                  ] as { icon: string; label: string; divider?: boolean; danger?: boolean }[]
                ).map((item) => (
                  <View key={item.label}>
                    {item.divider ? (
                      <View style={{ height: 1, backgroundColor: C.hair, marginVertical: 4 }} />
                    ) : null}
                    <Pressable
                      onPress={() => {
                        setDotsMenu(null);
                        if (item.label === "Remove exercise") setConfirmRemove(dotsMenu.ei);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 11,
                      }}
                    >
                      <Icon name={item.icon} size={17} color={item.danger ? C.badAcc : C.inkSoft} />
                      <Txt size={14} weight="semibold" color={item.danger ? C.badAcc : C.ink}>
                        {item.label}
                      </Txt>
                    </Pressable>
                  </View>
                ))}
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
                borderRadius: R.ctrl,
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
                  borderRadius: R.ctrl,
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
                  borderRadius: R.ctrl,
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
                    borderRadius: R.ctrl,
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
                    borderRadius: R.ctrl,
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

      {confirmRemove != null ? (
        <ConfirmDialog
          title="Remove exercise?"
          message={`${name(w.entries[confirmRemove].exerciseId)} and its sets will be removed from this workout.`}
          confirmLabel="Remove"
          onConfirm={() => setEntries(w.entries.filter((_, i) => i !== confirmRemove))}
          onClose={() => setConfirmRemove(null)}
        />
      ) : null}

      {info
        ? (() => {
            const e = exercises.find((x) => x.id === info);
            return e ? (
              <ExerciseInfo
                exercise={{
                  libId: e.id,
                  dbId: e.dbId,
                  name: e.name,
                  bodyPart: e.bodyPart,
                  equipment: e.equipment,
                  gifUrl: e.dbId ? DB_GIF_BY_ID[e.dbId] : undefined,
                }}
                onClose={() => setInfo(null)}
              />
            ) : null;
          })()
        : null}

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

/**
 * CARDLESS routine row (replaced the old fixed-height grid card): bare
 * text block — bold name with the ⋯ menu on the right, one faint preview
 * line of the set scheme. Whole row starts the routine; rows are separated
 * by Dividers in the list.
 */
function RoutineRow({
  name,
  lines,
  onPress,
  onMenu,
  faint,
}: {
  name: string;
  lines: string[];
  onPress: () => void;
  onMenu: () => void;
  faint?: boolean;
}) {
  const preview =
    lines.slice(0, 3).join(" · ") + (lines.length > 3 ? " · ···" : "");
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 12, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt
          size={15}
          weight="bold"
          style={{ flex: 1 }}
          color={faint ? C.inkFaint : C.ink}
          numberOfLines={1}
        >
          {name}
        </Txt>
        <Pressable hitSlop={10} onPress={onMenu}>
          <Icon name="Ellipsis" size={18} color={C.inkSoft} />
        </Pressable>
      </View>
      <Txt size={12} color={C.inkFaint} numberOfLines={1}>
        {preview}
      </Txt>
    </Pressable>
  );
}

/** "Home" → "Home (1)", skipping suffixes already in use. */
function uniqueName(base: string, taken: string[]): string {
  const stripped = base.replace(/ \(\d+\)$/, "");
  const names = new Set(taken);
  for (let n = 1; ; n++) {
    const candidate = `${stripped} (${n})`;
    if (!names.has(candidate)) return candidate;
  }
}

/** The routine ⋯ menu's subject. */
type RoutineMenuTarget =
  | { kind: "mine"; routine: Routine }
  | { kind: "rec"; rec: RecommendedRoutine };

function RenameDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <CenterDialog onClose={onClose}>
      <Txt size={18} weight="extrabold">Rename routine</Txt>
      <TextField value={draft} onChange={setDraft} placeholder="Routine name" />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 22, marginTop: 2 }}>
        <Pressable hitSlop={8} onPress={onClose}>
          <Txt size={14} weight="bold" color={C.inkFaint}>Cancel</Txt>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => {
            if (draft.trim()) onSave(draft.trim());
            onClose();
          }}
        >
          <Txt size={14} weight="extrabold" color={C.goodAcc}>Save</Txt>
        </Pressable>
      </View>
    </CenterDialog>
  );
}

export function Workout() {
  const {
    activeWorkout,
    exercises,
    routines,
    startWorkout,
    startRecommended,
    saveRoutine,
    updateRoutine,
    deleteRoutine,
    importRecommended,
  } = useStore();
  /** The just-finished session, shown as the post-workout summary. */
  const [summary, setSummary] = useState<WorkoutModel | null>(null);
  const [confirmRoutine, setConfirmRoutine] = useState<{ id: string; name: string } | null>(null);
  const [menu, setMenu] = useState<RoutineMenuTarget | null>(null);
  const [renaming, setRenaming] = useState<Routine | null>(null);
  const [editing, setEditing] = useState<Routine | null>(null);
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const routineNames = routines.map((r) => r.name);

  const duplicateMine = (r: Routine) => {
    saveRoutine(
      uniqueName(r.name, routineNames),
      r.entries.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })),
    );
  };

  const shareRoutine = (name: string, lines: string[]) =>
    void Share.share({ message: `${name}\n\n${lines.join("\n")}\n\nShared from Torq` });

  const mineLines = (r: Routine) =>
    r.entries.map((e) => {
      const top = Math.max(...e.sets.map((s) => s.weight), 0);
      const reps = targetRepsOf(e.sets);
      return `${e.sets.length} × ${reps || "?"} ${exName(e.exerciseId)}${top > 0 ? ` @ ${top}` : ""}`;
    });

  if (activeWorkout) return <ActiveSession onFinished={setSummary} />;

  const visible = routines.filter((r) => !r.archived);
  const archived = routines.filter((r) => r.archived);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: TOP_BAR_SPACE + 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={26} weight="extrabold">Workout</Txt>

      <Eyebrow>Quick start</Eyebrow>
      <Pressable
        onPress={() => startWorkout()}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: R.ctrl,
            backgroundColor: C.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Play" size={18} color={C.accentInk} />
        </View>
        <View style={{ gap: 1 }}>
          <Txt size={16} weight="bold">Empty workout</Txt>
          <Txt size={12} color={C.inkSoft}>Begin from scratch</Txt>
        </View>
      </Pressable>

      <Eyebrow>Routines ({visible.length})</Eyebrow>
      {visible.length === 0 ? (
        <Txt size={13} color={C.inkFaint}>
          No routines yet. Start with a recommended one below — finishing it
          keeps its exercises in your library.
        </Txt>
      ) : (
        <View>
          {visible.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <RoutineRow
                name={r.name}
                lines={r.entries.map((e) => `${e.sets.length} × ${exName(e.exerciseId)}`)}
                onPress={() => startWorkout(r)}
                onMenu={() => setMenu({ kind: "mine", routine: r })}
              />
            </View>
          ))}
        </View>
      )}

      <Eyebrow>Recommended</Eyebrow>
      <View>
        {RECOMMENDED.map((r, i) => (
          <View key={r.name}>
            {i > 0 ? <Divider /> : null}
            <RoutineRow
              name={r.name}
              lines={r.items
                .filter((item) => DB_BY_ID[item.dbId])
                .map((item) => `${item.sets} × ${titleCase(DB_BY_ID[item.dbId].name)}`)}
              onPress={() => startRecommended(r)}
              onMenu={() => setMenu({ kind: "rec", rec: r })}
            />
          </View>
        ))}
      </View>

      {archived.length > 0 ? (
        <>
          <Eyebrow>Archived ({archived.length})</Eyebrow>
          <View>
            {archived.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <RoutineRow
                  faint
                  name={r.name}
                  lines={r.entries.map((e) => `${e.sets.length} × ${exName(e.exerciseId)}`)}
                  onPress={() => setMenu({ kind: "mine", routine: r })}
                  onMenu={() => setMenu({ kind: "mine", routine: r })}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>

      {menu?.kind === "mine" ? (
        <CenterDialog onClose={() => setMenu(null)}>
          <Txt size={18} weight="extrabold" numberOfLines={1}>{menu.routine.name}</Txt>
          <View>
            {!menu.routine.archived ? (
              <>
                <MenuRow
                  icon="Pencil"
                  label="Edit"
                  onPress={() => {
                    setMenu(null);
                    setEditing(menu.routine);
                  }}
                />
                <MenuRow
                  icon="FileText"
                  label="Rename"
                  onPress={() => {
                    setMenu(null);
                    setRenaming(menu.routine);
                  }}
                />
                <MenuRow
                  icon="Archive"
                  label="Archive"
                  onPress={() => {
                    updateRoutine(menu.routine.id, { archived: true });
                    setMenu(null);
                  }}
                />
              </>
            ) : (
              <MenuRow
                icon="ArchiveRestore"
                label="Unarchive"
                onPress={() => {
                  updateRoutine(menu.routine.id, { archived: undefined });
                  setMenu(null);
                }}
              />
            )}
            <MenuRow
              icon="Copy"
              label="Duplicate"
              onPress={() => {
                duplicateMine(menu.routine);
                setMenu(null);
              }}
            />
            <MenuRow
              icon="Share2"
              label="Share"
              onPress={() => {
                setMenu(null);
                shareRoutine(menu.routine.name, mineLines(menu.routine));
              }}
            />
            <MenuRow
              icon="Trash2"
              label="Delete"
              color={C.badAcc}
              onPress={() => {
                setMenu(null);
                setConfirmRoutine({ id: menu.routine.id, name: menu.routine.name });
              }}
            />
          </View>
        </CenterDialog>
      ) : null}

      {menu?.kind === "rec" ? (
        <CenterDialog onClose={() => setMenu(null)}>
          <Txt size={18} weight="extrabold" numberOfLines={1}>{menu.rec.name}</Txt>
          <View>
            <MenuRow
              icon="Copy"
              label="Duplicate to my routines"
              onPress={() => {
                // Plain name unless it's already taken (plan days often are).
                const name = routineNames.includes(menu.rec.name)
                  ? uniqueName(menu.rec.name, routineNames)
                  : menu.rec.name;
                importRecommended(menu.rec, name);
                setMenu(null);
              }}
            />
          </View>
        </CenterDialog>
      ) : null}

      {renaming ? (
        <RenameDialog
          initial={renaming.name}
          onSave={(name) => updateRoutine(renaming.id, { name })}
          onClose={() => setRenaming(null)}
        />
      ) : null}

      {editing ? (
        <RoutineEditor routine={editing} onClose={() => setEditing(null)} />
      ) : null}

      {confirmRoutine ? (
        <ConfirmDialog
          title="Delete routine?"
          message={`"${confirmRoutine.name}" will be deleted. Finished workouts stay in your history.`}
          onConfirm={() => deleteRoutine(confirmRoutine.id)}
          onClose={() => setConfirmRoutine(null)}
        />
      ) : null}

      {summary ? (
        <WorkoutSummary workout={summary} onClose={() => setSummary(null)} />
      ) : null}
    </View>
  );
}
