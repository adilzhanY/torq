/**
 * The ladder — all nine tiers as a board you can see at once (Adilzhan,
 * 2026-08-09: "show the list of rank tiers and how many points is needed…
 * make it look like in games, so they are disabled, but user can see how
 * they look like").
 *
 * Until now the tiers existed only as thresholds inside rank.ts: the app
 * told you your tier and the next one, and never showed you the board. A
 * ladder you cannot see is not a ladder — half the pull of a rank system is
 * looking at the thing you have not earned yet.
 *
 * The three states, and why they look the way they do:
 *  - EARNED — full colour, and the orbit is turning. It's yours.
 *  - CURRENT — the same, plus a lime frame and the points you still need.
 *  - LOCKED — the real badge art at low opacity behind a dimming veil, with
 *    the points required. Deliberately NOT a silhouette or a "?" tile: the
 *    whole point is that you can see exactly what Diamond looks like while
 *    you are still Silver. The orbit is frozen there, so "alive" reads as
 *    the difference between earned and not.
 */
import { View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";
import { RankBadge } from "./RankBadge";
import { TIER_COLORS, TIER_NAMES, type TierName } from "../lib/rank";

/** Per-lift DOTS thresholds from rank.ts; overall multiplies them by 3. */
const LIFT_MIN: Record<TierName, number> = {
  Rust: 0,
  Iron: 30,
  Bronze: 45,
  Silver: 60,
  Gold: 75,
  Platinum: 95,
  Diamond: 115,
  Elite: 140,
  "World Class": 165,
};

export function TierLadder({
  points,
  /** 1 for a single lift, 3 for the overall score. */
  scale = 3,
  /** Badge width inside each cell. */
  badgeSize = 96,
}: {
  points: number;
  scale?: number;
  badgeSize?: number;
}) {
  const currentIndex = TIER_NAMES.reduce(
    (acc, name, i) => (points >= LIFT_MIN[name] * scale ? i : acc),
    0,
  );

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {TIER_NAMES.map((name, i) => {
        const floor = LIFT_MIN[name] * scale;
        const earned = i <= currentIndex;
        const current = i === currentIndex;
        const toGo = Math.max(0, Math.ceil(floor - points));

        return (
          <View key={name} style={{ width: "33.333%", padding: 4 }}>
            <View
              style={{
                borderRadius: R.md,
                borderWidth: 1,
                borderColor: current ? C.accent : C.line,
                backgroundColor: current ? "rgba(200,254,35,0.06)" : C.surface,
                paddingVertical: 10,
                paddingHorizontal: 6,
                alignItems: "center",
                gap: 2,
              }}
            >
              {/* Dim enough to read as locked, bright enough that you can
                  actually SEE the Diamond you are working toward — that is
                  the whole point of showing it. */}
              <View style={{ opacity: earned ? 1 : 0.45 }}>
                {/* Locked badges show their real art — dimmed, not hidden —
                    and stand still; motion is the reward. */}
                <RankBadge tier={name} stage={4} size={badgeSize} animated={earned} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {!earned ? <Icon name="Lock" size={9} color={C.inkFaint} /> : null}
                <Txt
                  size={11}
                  weight="extrabold"
                  color={earned ? TIER_COLORS[name] : C.inkFaint}
                  numberOfLines={1}
                >
                  {name === "World Class" ? "World" : name}
                </Txt>
              </View>

              <Txt size={10} weight="bold" color={earned ? C.inkSoft : C.inkFaint}>
                {earned
                  ? floor === 0
                    ? "start"
                    : `${Math.round(floor)} pts`
                  : `+${toGo} pts`}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}
