/**
 * StreakDialog — the Duolingo-style celebration (Adilzhan's reference
 * image): the streak mark breathing inside a soft halo, a giant count,
 * a personalised line, a Monday-first week strip and the longest-streak
 * trophy. Auto-pops once per trained day from Home; the pill reopens it.
 *
 * The mark used to be a hand-authored Lottie (assets/flame.json). It was
 * replaced 2026-08-09 by `StreakMarkLive` when the app got its OWN streak
 * icon: keeping the Lottie would have meant this dialog celebrating with a
 * different flame from the pill that opened it. The motion it had that
 * mattered — squash-and-stretch flicker, rising embers — came with it.
 * assets/flame.json is kept in the repo but is no longer referenced.
 */
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { StreakMarkLive } from "./StreakMark";
import { Icon } from "./Icon";
import { CustomModal } from "./CustomModal";
import { Txt } from "./ui";
import type { Streak } from "../lib/streak";
import type { Workout } from "../types";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Local midnight `n` days after the given local midnight. */
function addDays(dayMs: number, n: number): number {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

export function StreakDialog({
  streak,
  workouts,
  userName,
  onClose,
}: {
  streak: Streak;
  workouts: Workout[];
  userName?: string;
  onClose: () => void;
}) {
  const today = new Date().setHours(0, 0, 0, 0);
  const d = new Date(today);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  const workoutDays = new Set(
    workouts.filter((w) => w.endedAt).map((w) => new Date(w.startedAt).setHours(0, 0, 0, 0)),
  );
  const week = LETTERS.map((letter, i) => {
    const ms = addDays(monday, i);
    return {
      letter,
      num: new Date(ms).getDate(),
      done: workoutDays.has(ms),
      isToday: ms === today,
    };
  });

  const name = userName?.trim();
  const subtitle = streak.atRisk
    ? "One more missed session and it resets — train today!"
    : streak.current > 0
      ? `You're doing really great${name ? `, ${name}` : ""}!`
      : "Start a new streak today — one workout is all it takes.";

  return (
    <CustomModal onClose={onClose}>
      <View style={{ alignItems: "center", gap: 2, paddingTop: 6 }}>
        {/* Soft halo behind the flame, like the reference */}
        <View
          style={{
            width: 136,
            height: 136,
            borderRadius: 68,
            backgroundColor: "rgba(255,138,61,0.10)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StreakMarkLive size={112} color="#FF8A3D" />
        </View>
        <Txt size={52} weight="extrabold" style={{ marginTop: -4 }}>
          {streak.current}
        </Txt>
        <Txt size={21} weight="extrabold">Day Streak</Txt>
        <Txt
          size={13}
          weight={streak.atRisk ? "bold" : "medium"}
          color={streak.atRisk ? C.warnAcc : C.inkSoft}
          style={{ textAlign: "center", marginTop: 4 }}
        >
          {subtitle}
        </Txt>
      </View>

      {/* This week, Monday-first: check circles for trained days */}
      <View style={{ flexDirection: "row", paddingHorizontal: 2, marginTop: 8 }}>
        {week.map((day, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <Txt
              size={11}
              weight="bold"
              color={day.isToday ? C.ink : C.inkFaint}
            >
              {day.letter}
            </Txt>
            {day.done ? (
              <LinearGradient
                colors={["#FFB03F", "#FF7B33"]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Check" size={16} color="#fff" strokeWidth={3.5} />
              </LinearGradient>
            ) : (
              <View style={{ height: 34, alignItems: "center", justifyContent: "center" }}>
                <Txt
                  size={day.isToday ? 16 : 14}
                  weight={day.isToday ? "extrabold" : "semibold"}
                  color={day.isToday ? C.ink : C.inkFaint}
                >
                  {day.num}
                </Txt>
              </View>
            )}
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 4,
        }}
      >
        <Icon name="Trophy" size={14} color={C.gold} />
        <Txt size={12} weight="bold" color={C.inkFaint}>
          Longest: {streak.longest} day{streak.longest === 1 ? "" : "s"}
        </Txt>
      </View>
    </CustomModal>
  );
}
