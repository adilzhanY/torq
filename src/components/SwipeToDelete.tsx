/**
 * Swipe a row left to reveal a Delete action (Strong's gesture, 2026-08-09).
 *
 * HAND-ROLLED on PanResponder + Animated rather than
 * `react-native-gesture-handler`'s Swipeable, for the same reason the keyboard
 * handling is hand-rolled: the dependency is not currently in this project, its
 * legacy Swipeable is deprecated in favour of a Reanimated one, and Reanimated
 * needs a babel plugin, and this app has NO babel.config.js at all, because
 * NativeWind v5 is CSS-first. Trading a 60-line gesture for a build-config
 * change is a bad deal when the gesture is one axis with two rest positions.
 *
 * The gesture is claimed CONSERVATIVELY: only once the finger has travelled
 * 12 px and is moving clearly sideways (|dx| > 1.6·|dy|). Below that the touch
 * still belongs to the row, so tapping a weight field, ticking a set and
 * scrolling the session all behave exactly as before.
 *
 * Opening is CONTROLLED by the parent (`isOpen` + `onOpenChange`) so only one
 * row can sit open at a time. Two half-open rows read as a rendering bug.
 */
import { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, View, type ViewStyle } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";

/** Width of the revealed Delete panel. */
const ACTION_W = 88;
/** How far past the panel the row can be dragged, for rubber-band feel. */
const OVERDRAG = 26;

export function SwipeToDelete({
  children,
  onDelete,
  isOpen,
  onOpenChange,
  /** Painted under the sliding row so the action never shows through it. */
  background = C.page,
  style,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  background?: string;
  style?: ViewStyle;
}) {
  const x = useRef(new Animated.Value(0)).current;
  /** Where the row settled last, so a second drag continues from there. */
  const settled = useRef(0);
  // PanResponder is created once; its handlers would capture the first render's
  // props forever, so the live ones are read through a ref.
  const cb = useRef({ onOpenChange });
  cb.current = { onOpenChange };

  const settle = (open: boolean) => {
    settled.current = open ? -ACTION_W : 0;
    Animated.spring(x, {
      toValue: settled.current,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  // The parent closes this row when another one opens.
  useEffect(() => {
    if (!isOpen && settled.current !== 0) settle(false);
    if (isOpen && settled.current === 0) settle(true);
  }, [isOpen]);

  const pan = useRef(
    PanResponder.create({
      // CAPTURE, not bubble: the row is full of Pressables and TextInputs, and
      // once a child holds the responder an ancestor can only take it during
      // the capture phase. The threshold is what keeps taps and vertical
      // scrolling with the child, they never travel 12 px sideways.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => {
        const next = Math.max(
          -ACTION_W - OVERDRAG,
          Math.min(0, settled.current + g.dx),
        );
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const at = settled.current + g.dx;
        // Either dragged past the halfway point or flicked hard enough.
        const open = g.vx < -0.4 || (g.vx <= 0.4 && at < -ACTION_W * 0.5);
        settle(open);
        cb.current.onOpenChange(open);
      },
      onPanResponderTerminate: () => settle(settled.current !== 0),
    }),
  ).current;

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Pressable
        onPress={onDelete}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: ACTION_W,
          backgroundColor: C.badSurf,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 6,
        }}
      >
        <Icon name="Trash2" size={15} color={C.badAcc} />
        <Txt size={12.5} weight="bold" color={C.badAcc}>Delete</Txt>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{ backgroundColor: background, transform: [{ translateX: x }] }}
      >
        {children}
        {/* While the row is open its own controls are shifted off their
            labels, so a tap should close it rather than land on whatever
            slid under the finger. */}
        {isOpen ? (
          <Pressable
            onPress={() => cb.current.onOpenChange(false)}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
