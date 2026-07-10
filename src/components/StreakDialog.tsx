/**
 * Streak celebration dialog (Duolingo-style, reference: week-streak card):
 * hand-authored Lottie flame (assets/flame.json — flickering squash &
 * stretch, counter-phased white core, rising embers) in a soft halo, the
 * giant day count, encouragement, this week's M–S strip (orange gradient
 * check circles on trained days, plain day numbers otherwise, today bold),
 * and the longest-streak line.
 */
import { View } from "react-native";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Icon } from "./Icon";
import { CenterDialog } from "./Dialog";
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
    <CenterDialog onClose={onClose}>
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
          <LottieView
            source={require("../../assets/flame.json")}
            autoPlay
            loop
            style={{ width: 118, height: 118 }}
          />
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
    </CenterDialog>
  );
}
