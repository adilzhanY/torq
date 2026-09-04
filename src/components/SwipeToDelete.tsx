/**
 * Swipe a row all the way left to delete it (2026-08-11, Adilzhan: "it should
 * let me drag it fully to the left, and the whole line is red. When it's all
 * red then show a confirmation dialog").
 *
 * It used to reveal an 88 px Delete button that you then had to hit, which is
 * Strong's pattern and two gestures for one decision. Now the swipe IS the
 * decision: the red bed grows behind the row as you pull, and past the
 * commit point the whole line goes bright red, so the row tells you what will
 * happen before you let go. Releasing there asks for confirmation; releasing
 * short of it springs back and nothing happened.
 *
 * The confirm lives with the PARENT, not here. This component only reports
 * that a full swipe happened and takes `open` back as a prop, so cancelling
 * the dialog is what returns the row. Owning a dialog inside a gesture
 * component would put the same modal in every row of the list.
 *
 * HAND-ROLLED on PanResponder + Animated rather than
 * `react-native-gesture-handler`'s Swipeable: the dependency is not in this
 * project, its legacy Swipeable is deprecated in favour of a Reanimated one,
 * and Reanimated needs a babel plugin, which this app does not have at all
 * because NativeWind v5 is CSS-first.
 *
 * The gesture is claimed CONSERVATIVELY, and in the CAPTURE phase: the row is
 * full of Pressables and TextInputs, and once a child holds the responder an
 * ancestor can only take it during capture. Below 12 px of clearly sideways
 * travel the touch still belongs to the child, so tapping a weight field,
 * ticking a set and scrolling the session all behave as before.
 */
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Vibration, View, type ViewStyle } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";

/** Fraction of the row width that commits to the delete. */
const COMMIT = 0.55;

export function SwipeToDelete({
  children,
  onRequestDelete,
  open,
  /** Painted under the sliding row so the red bed never shows through it. */
  background = C.page,
  style,
}: {
  children: React.ReactNode;
  /** The row was pulled past the commit point. Ask the user, then either
   *  unmount the row or set `open` back to false. */
  onRequestDelete: () => void;
  /** Held fully open while the parent's confirmation is up. */
  open: boolean;
  background?: string;
  style?: ViewStyle;
}) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const settled = useRef(0);
  const armed = useRef(false);
  // PanResponder is built once, so its handlers would capture the first
  // render's props forever. The live ones are read through refs.
  const live = useRef({ width, onRequestDelete });
  live.current = { width, onRequestDelete };

  const settle = (to: number) => {
    settled.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  };

  // Cancelling the dialog is what brings the row back.
  useEffect(() => {
    if (!open && settled.current !== 0) {
      armed.current = false;
      settle(0);
    }
  }, [open]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => {
        const w = live.current.width || 1;
        const next = Math.max(-w, Math.min(0, settled.current + g.dx));
        x.setValue(next);
        // One short buzz the moment it commits, the way the OS does it, so
        // you can feel the point of no return without watching the colour.
        const past = next <= -w * COMMIT;
        if (past !== armed.current) {
          armed.current = past;
          if (past) Vibration.vibrate(12);
        }
      },
      onPanResponderRelease: (_, g) => {
        const w = live.current.width || 1;
        const at = settled.current + g.dx;
        // Past the commit point, or flicked hard enough to mean it.
        if (at <= -w * COMMIT || g.vx < -1.2) {
          settle(-w);
          live.current.onRequestDelete();
        } else {
          armed.current = false;
          settle(0);
        }
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        settle(0);
      },
    }),
  ).current;

  const commitAt = -(width || 1) * COMMIT;
  /** The bed goes from a dark red to the full red exactly at the commit. */
  const hot = x.interpolate({
    inputRange: [commitAt * 1.25, commitAt * 0.75],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  /** The label rides in from the right edge rather than sitting there. */
  const labelIn = x.interpolate({
    inputRange: [commitAt, commitAt * 0.35],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[{ overflow: "hidden" }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {/* The red bed. Dark while you are still deciding, full red once the
          swipe commits, which is the whole feedback of the gesture. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: C.badSurf,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingHorizontal: 16,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: C.badAcc,
            opacity: hot,
          }}
        />
        <Animated.View
          style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: labelIn }}
        >
          <Icon name="Trash2" size={15} color={C.ink} />
          <Txt size={12.5} weight="bold" color={C.ink}>Delete</Txt>
        </Animated.View>
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={{ backgroundColor: background, transform: [{ translateX: x }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
