/**
 * Bottom dock: "Five, spelled out" (Adilzhan picked it from the lavish
 * review `.lavish/torq-navbar.html`, 2026-08-09).
 *
 * The old dock morphed a capsule between six tabs plus a profile button.
 * Measured on a 360 dp screen that left an idle tab at ~36 dp (under
 * Android's 48 dp minimum touch target) with only the active tab labelled,
 * and every tap reflowed all seven targets sideways under the thumb. So:
 *
 *  - SIX fixed slots (~58 dp each). Nothing resizes, nothing slides, so
 *    muscle memory works from the second session on. History came back into
 *    the dock on 2026-08-09 after Adilzhan simply could not find it: the
 *    original 36 dp squeeze was six tabs PLUS a profile button PLUS a
 *    capsule stealing 2.6× the width, and with the morph gone six equal
 *    slots still clear Android's 48 dp minimum comfortably.
 *  - Every tab carries its NAME. Medal, dumbbell and flexed-bicep all read
 *    as "training" to someone new; icons alone were doing too much work.
 *  - The active tab is lime with a short rail at the top edge, the only
 *    thing that animates, and it animates in place.
 *  - Profile is the last slot as the user's AVATAR, not a generic glyph:
 *    it doubles as "who is signed in".
 *
 * Exercises is the one screen still outside the dock: it is a sub-page of
 * Workout, reached from that tab's library row, and its PARENT tab stays lit
 * while it is open so the dock never shows nothing selected. Home's "Recent
 * workouts · See all" survives as a shortcut into History even though
 * History is a tab again, a second door into a room is not a problem.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useUi, type Tab } from "../lib/ui";
import { C, R, clay } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/store";
import { avatarSource } from "../lib/avatar";

const ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: "home", label: "Home", icon: "House" },
  { tab: "workout", label: "Workout", icon: "Dumbbell" },
  { tab: "history", label: "History", icon: "History" },
  { tab: "ranks", label: "Ranks", icon: "Medal" },
  { tab: "stats", label: "Stats", icon: "ChartColumn" },
];

/** Which dock tab owns a screen that is no longer in the dock. */
const PARENT: Partial<Record<Tab, Tab>> = {
  exercises: "workout",
};

/** Idle tabs are SOLID ink, not a translucent white: alpha over the dark
 * dock read as dimmed or disabled (Adilzhan, 2026-09-04). The active tab
 * is told apart by lime and the rail, not by opacity. */
const IDLE = C.ink;

/** Shared shell so every tab and the avatar slot measure identically. */
function Slot({
  active,
  onPress,
  label,
  children,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      // Only scaleX and opacity: both native-drivable, and nothing here
      // touches layout, which is the whole point of the redesign.
      useNativeDriver: true,
    }).start();
  }, [active, v]);

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}
    >
      {/* The rail sits on the dock's top edge, above the icon. Narrower
          than the slot so six of them never touch. */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          width: 24,
          height: 3,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: C.accent,
          transform: [{ scaleX: v }],
          opacity: v,
        }}
      />
      {children}
      <Txt size={10} weight="bold" color={active ? C.accent : IDLE} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function BottomNav({ onProfile }: { onProfile: () => void }) {
  const { tab, setTab } = useUi();
  const { settings } = useStore();
  const current = PARENT[tab] ?? tab;

  return (
    <View
      style={[
        {
          position: "absolute",
          left: 14,
          right: 14,
          // The root SafeAreaView already reserves the navigation-bar
          // inset, so this is a plain visual gap, not a safe-area dodge.
          bottom: 16,
          height: 64,
          borderRadius: R.lg,
          backgroundColor: C.primary,
          borderWidth: 1,
          borderColor: C.line,
          flexDirection: "row",
          paddingHorizontal: 4,
          overflow: "hidden",
        },
        clay(),
      ]}
    >
      {ITEMS.map((it) => {
        const active = current === it.tab;
        return (
          <Slot key={it.tab} active={active} label={it.label} onPress={() => setTab(it.tab)}>
            <Icon name={it.icon} size={21} color={active ? C.accent : IDLE} />
          </Slot>
        );
      })}

      {/* Profile: the last slot, and the only one that opens an overlay
          rather than switching tabs, so it never takes the active state. */}
      <Slot active={false} label="You" onPress={onProfile}>
        <Avatar uri={avatarSource(settings)} name={settings.name} size={23} />
      </Slot>
    </View>
  );
}
