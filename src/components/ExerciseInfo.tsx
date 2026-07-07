/**
 * Exercise info page (Strong-style): About / History / Records tabs in a
 * full-screen inline overlay. Opened by tapping an exercise name in the
 * live session and by tapping a row on the Exercises tab.
 *
 * - About: demo gif, muscles, instructions, add-to/delete-from library.
 * - History: History-style cards for every workout containing the exercise;
 *   tapping one opens the full WorkoutSummary with this exercise ringed in
 *   light green.
 * - Records: personal records, best real performance per rep count with the
 *   estimated rep-max curve (inverse Epley off the best 1RM), lifetime stats.
 */
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { SlideUp } from "./anim";
import { Card, Divider, Pill, PrimaryButton, SectionTitle, Txt } from "./ui";
import { WorkoutCard } from "./WorkoutCard";
import { WorkoutSummary } from "./WorkoutSummary";
import { useStore } from "../lib/store";
import { DB_BY_ID } from "../lib/exercisedb";
import { est1RM, repMax } from "../lib/stats";
import type { BodyPart, Equipment, Workout } from "../types";

/** Everything the page needs to know about the exercise being shown.
 * BrowserItem satisfies this shape; the live session builds one from the
 * library row. */
export interface ExerciseRef {
  libId?: string;
  dbId?: string;
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  gifUrl?: string;
}

type InfoTab = "about" | "history" | "records";
const TABS: { key: InfoTab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "history", label: "History" },
  { key: "records", label: "Records" },
];

const MONTHS3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS3[d.getMonth()]} ${d.getFullYear()}`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Txt size={14} weight="semibold">{label}</Txt>
      <Txt size={14} weight="extrabold">{value}</Txt>
    </View>
  );
}

export function ExerciseInfo({
  exercise,
  onClose,
}: {
  exercise: ExerciseRef;
  onClose: () => void;
}) {
  const { exercises, workouts, settings, addExercise, deleteExercise } = useStore();
  const [tab, setTab] = useState<InfoTab>("about");
  /** A history workout opened as a full summary (exercise highlighted). */
  const [viewing, setViewing] = useState<Workout | null>(null);

  // Re-resolve against the store so importing flips the About actions live.
  const libRow = exercises.find((e) =>
    exercise.libId ? e.id === exercise.libId : e.dbId != null && e.dbId === exercise.dbId,
  );
  const db = exercise.dbId ? DB_BY_ID[exercise.dbId] : undefined;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (viewing) setViewing(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [viewing, onClose]);

  /** All logged sets of this exercise (with workout date), newest data wins. */
  const log = useMemo(() => {
    const out: { weight: number; reps: number; at: number; warmup: boolean }[] = [];
    if (!libRow) return out;
    for (const w of workouts) {
      for (const e of w.entries) {
        if (e.exerciseId !== libRow.id) continue;
        for (const s of e.sets) {
          out.push({ weight: s.weight, reps: s.reps, at: w.startedAt, warmup: s.type === "warmup" });
        }
      }
    }
    return out;
  }, [workouts, libRow]);

  const related = useMemo(
    () =>
      libRow
        ? workouts
            .filter((w) => w.entries.some((e) => e.exerciseId === libRow.id))
            .sort((a, b) => b.startedAt - a.startedAt)
        : [],
    [workouts, libRow],
  );

  const rec = useMemo(() => {
    // Warmups don't set records (same rule as computePRs); lifetime counts all.
    const work = log.filter((s) => !s.warmup && s.weight > 0 && s.reps > 0);
    let best1 = 0;
    let maxW = 0;
    let maxV = 0;
    for (const s of work) {
      best1 = Math.max(best1, est1RM(s.weight, s.reps));
      maxW = Math.max(maxW, s.weight);
      maxV = Math.max(maxV, s.weight * s.reps);
    }
    // Best real performance at N reps = heaviest set done for at least N.
    const maxReps = Math.min(12, work.reduce((m, s) => Math.max(m, s.reps), 0));
    const rows: { n: number; weight: number; reps: number; at: number; est: number }[] = [];
    for (let n = 1; n <= maxReps; n++) {
      let best: (typeof work)[number] | null = null;
      for (const s of work) {
        if (s.reps >= n && (!best || s.weight > best.weight)) best = s;
      }
      if (best) rows.push({ n, weight: best.weight, reps: best.reps, at: best.at, est: repMax(best1, n) });
    }
    return {
      best1,
      maxW,
      maxV,
      rows,
      totalReps: log.reduce((a, s) => a + s.reps, 0),
      totalVol: log.reduce((a, s) => a + s.weight * s.reps, 0),
    };
  }, [log]);

  const u = settings.unit;

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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 10 }}>
        <Pressable hitSlop={8} onPress={onClose}>
          <Icon name="ChevronLeft" size={24} color={C.ink} />
        </Pressable>
        <Txt size={20} weight="extrabold" numberOfLines={1} style={{ flex: 1 }}>
          {libRow?.name ?? exercise.name}
        </Txt>
      </View>

      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 4 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              backgroundColor: tab === t.key ? C.primary : C.page2,
              borderRadius: R.pill,
              paddingHorizontal: 16,
              paddingVertical: 7,
            }}
          >
            <Txt size={12} weight="bold" color={tab === t.key ? "#fff" : C.inkSoft}>
              {t.label}
            </Txt>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
        {tab === "about" ? (
          <>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Pill text={exercise.bodyPart} color={C.inkSoft} bg={C.surface} />
              <Pill text={exercise.equipment} color={C.inkSoft} bg={C.surface} />
              {libRow ? <Pill text="in your library" color={C.goodAcc} bg={C.goodSurf} /> : null}
            </View>
            {exercise.gifUrl ? (
              <Image
                source={{ uri: exercise.gifUrl }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: R.md, backgroundColor: "#fff" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 160,
                  borderRadius: R.md,
                  backgroundColor: C.page2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Dumbbell" size={44} color={C.inkFaint} />
              </View>
            )}
            {db ? (
              <>
                <Txt size={12} weight="bold" color={C.inkSoft}>
                  Targets {db.targetMuscles.join(", ")}
                  {db.secondaryMuscles.length ? ` · also ${db.secondaryMuscles.join(", ")}` : ""}
                </Txt>
                <View style={{ gap: 6 }}>
                  {db.instructions.map((step, i) => (
                    <Txt key={i} size={13} color={C.inkSoft}>
                      {step.replace(/^Step:\d+\s*/, `${i + 1}. `)}
                    </Txt>
                  ))}
                </View>
              </>
            ) : null}
            {!libRow ? (
              <PrimaryButton
                label="Add to my exercises"
                background={C.accent}
                color={C.accentInk}
                onPress={() =>
                  addExercise({
                    name: exercise.name,
                    bodyPart: exercise.bodyPart,
                    equipment: exercise.equipment,
                    dbId: exercise.dbId,
                  })
                }
              />
            ) : (
              <PrimaryButton
                label="Delete from my exercises"
                background={C.badSurf}
                color={C.badAcc}
                onPress={() => {
                  deleteExercise(libRow.id);
                  onClose();
                }}
              />
            )}
          </>
        ) : null}

        {tab === "history" ? (
          related.length === 0 ? (
            <Card>
              <Txt size={13} color={C.inkFaint}>
                No workouts with this exercise yet.
              </Txt>
            </Card>
          ) : (
            related.map((w) => (
              <WorkoutCard key={w.id} workout={w} onPress={() => setViewing(w)} />
            ))
          )
        ) : null}

        {tab === "records" ? (
          rec.rows.length === 0 ? (
            <Card>
              <Txt size={13} color={C.inkFaint}>
                No sets logged yet — records show up after the first finished
                workout with this exercise.
              </Txt>
            </Card>
          ) : (
            <>
              <SectionTitle>Personal records</SectionTitle>
              <Card style={{ gap: 10 }}>
                <StatRow label="Estimated 1RM" value={`${rec.best1} ${u}`} />
                <Divider />
                <StatRow label="Max weight" value={`${rec.maxW} ${u}`} />
                <Divider />
                <StatRow label="Max volume" value={`${rec.maxV} ${u}`} />
              </Card>

              <SectionTitle>Rep maxes</SectionTitle>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Txt size={11} weight="bold" color={C.inkFaint} style={{ width: 44 }}>
                    REPS
                  </Txt>
                  <Txt size={11} weight="bold" color={C.inkFaint} style={{ flex: 1 }}>
                    BEST PERFORMANCE
                  </Txt>
                  <Txt size={11} weight="bold" color={C.inkFaint}>
                    ESTIMATED
                  </Txt>
                </View>
                {rec.rows.map((r) => (
                  <View key={r.n} style={{ flexDirection: "row", alignItems: "center" }}>
                    <Txt size={14} weight="bold" color={C.inkSoft} style={{ width: 44 }}>
                      {r.n}
                    </Txt>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt size={14} weight="semibold">
                        {r.weight} {u} (×{r.reps})
                      </Txt>
                      <Txt size={11} color={C.inkFaint}>{fmtDay(r.at)}</Txt>
                    </View>
                    <Txt size={14} weight="bold" color={C.inkSoft}>
                      {r.est} {u}
                    </Txt>
                  </View>
                ))}
                <Txt size={11} color={C.inkFaint}>
                  Estimated rep maxes come from your best 1RM (Epley); best
                  performance is your heaviest real set at each rep count.
                </Txt>
              </Card>

              <SectionTitle>Lifetime stats</SectionTitle>
              <Card style={{ gap: 10 }}>
                <StatRow label="Total reps" value={`${rec.totalReps} reps`} />
                <Divider />
                <StatRow label="Total volume" value={`${Math.round(rec.totalVol)} ${u}`} />
              </Card>
            </>
          )
        ) : null}
      </ScrollView>

      {viewing ? (
        <WorkoutSummary
          workout={viewing}
          onClose={() => setViewing(null)}
          highlightExerciseId={libRow?.id}
        />
      ) : null}
    </SlideUp>
  );
}
