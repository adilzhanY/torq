/**
 * StreakDialog: the Duolingo-style celebration (Adilzhan's reference
 * image): the streak mark breathing inside a soft halo, a giant count,
 * a personalised line, a Monday-first week strip and the longest-streak
 * trophy. Auto-pops once per trained day from Home; the pill reopens it.
 *
 * The flame has been three things: a hand-authored Lottie
 * (assets/flame.json), then a hand-rolled vector mark, and now the designed
 * Lottie in assets/Streak.json that Adilzhan installed. Both earlier
 * versions are deleted, because the celebration here and the still beside
 * the day count on Home are finally the same creature, which is what neither
 * of the first two managed.
 */
import { View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import LottieView from "lottie-react-native";
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
    ? "One more missed session and it resets. Train today!"
    : streak.current > 0
      ? `You're doing really great${name ? `, ${name}` : ""}!`
      : "Start a new streak today. One workout is all it takes.";

  return (
    <CustomModal onClose={onClose}>
      <View style={{ alignItems: "center", gap: 2, paddingTop: 6 }}>
        {/* The celebration is a designed Lottie now (assets/Streak.json,
            recoloured to the brand lime by scripts/recolor-lottie.py) rather
            than the hand-rolled flicker loop it replaced. */}
        <View
          style={{
            width: 152,
            height: 152,
            borderRadius: 76,
            backgroundColor: "rgba(200,254,35,0.07)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LottieView
            source={require("../../assets/Streak.json")}
            autoPlay
            loop
            style={{ width: 148, height: 148 }}
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
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: C.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Lime is light, so the check is accentInk, never white. */}
                <Icon name="Check" size={16} color={C.accentInk} strokeWidth={3.5} />
              </View>
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
