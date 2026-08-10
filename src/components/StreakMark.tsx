/**
 * StreakMark: torq's own streak icon (Adilzhan picked concept A, "Cut
 * flame", from the lavish review `.lavish/torq-streak.html`, 2026-08-09).
 *
 * It replaces the icon pack's `Flame`, which was a stroked outline on a
 * screen where every other mark is solid, and the same flame that ships in a
 * few thousand other apps. This one is drawn in the app's own geometry: a solid
 * flame silhouette with two tapered BLADES cut out of it, curving the way
 * the vortex logo's blades curve. The silhouette stays legible at 14 px (
 * every candidate was rasterised at icon sizes before it was proposed,
 * because that is where icons die) and the vortex only shows itself once
 * the mark is big enough to reward a look.
 *
 * The geometry is generated, not hand-tweaked: the two cuts come from the
 * same tapered-blade function the concept sheet used, so re-deriving them
 * is a script run rather than a bezier-nudging session.
 *
 * NOT for calories. Kcal keeps the icon pack's stroked Flame (Tabler's,
 * since 2026-08-09), which is a deliberate distinction rather than a
 * collision: solid mark = your streak, outline = energy burnt.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "../theme";

/**
 * INK BOUNDS, measured (rasterise at 100 px/unit and trim), not eyeballed:
 * the flame occupies x 5.07–19.02, y 1.80–22.18 of the 24-unit box. Drawing
 * it in a square therefore left 3.15 units of dead air down each side, which
 * is why the streak pill's padding LOOKED lopsided while being geometrically
 * equal. The visual gap was 15.2 px on the left against 12 px on the right.
 * The default render is now the tight box at its true aspect, so `size` is
 * the flame's real height and padding maths means what it says.
 */
const INK = { x: 5.07, y: 1.8, w: 13.95, h: 20.38 };
export const STREAK_ASPECT = INK.w / INK.h;

/** Flame silhouette; the two blades are cut from it with the evenodd rule. */
const OUTER = "M12.5 1.8 C13.4 6.6 16.3 8.6 18 11.7 C20.1 15.6 18.8 19.7 15.4 21.4 C13.7 22.3 11.5 22.4 9.7 21.8 C5.9 20.5 4 16.3 5.7 12.8 C6.5 11.1 7.8 10.2 8.5 8.5 C9.4 9.9 9.8 11.2 9.9 12.7 C10.9 10.1 11.8 6.4 12.5 1.8 Z";
const SLIT_1 = "M13.47 20.12 L13.74 19.77 L13.99 19.40 L14.21 19.03 L14.41 18.65 L14.58 18.25 L14.73 17.85 L14.85 17.45 L14.94 17.04 L15.01 16.62 L15.06 16.21 L15.09 15.79 L15.09 15.37 L15.08 14.96 L15.04 14.54 L14.99 14.12 L14.93 13.71 L14.85 13.29 L14.75 12.87 L14.64 12.46 L14.52 12.03 L14.39 11.61 L14.25 11.18 L14.10 10.74 L13.94 10.30 L13.77 9.86 L13.60 9.40 L13.60 9.40 L13.76 9.86 L13.90 10.32 L14.01 10.77 L14.10 11.22 L14.16 11.66 L14.20 12.09 L14.22 12.52 L14.22 12.93 L14.20 13.34 L14.15 13.73 L14.09 14.11 L14.02 14.48 L13.92 14.84 L13.81 15.19 L13.69 15.52 L13.56 15.85 L13.42 16.16 L13.26 16.46 L13.10 16.76 L12.92 17.04 L12.74 17.32 L12.56 17.60 L12.36 17.87 L12.16 18.14 L11.95 18.41 L11.73 18.68 Z";
const SLIT_2 = "M11.02 19.61 L10.82 19.39 L10.62 19.17 L10.43 18.95 L10.25 18.73 L10.08 18.51 L9.91 18.29 L9.75 18.07 L9.59 17.84 L9.45 17.61 L9.31 17.37 L9.18 17.12 L9.07 16.87 L8.96 16.61 L8.86 16.35 L8.78 16.07 L8.71 15.79 L8.65 15.50 L8.61 15.20 L8.58 14.89 L8.57 14.58 L8.58 14.26 L8.61 13.94 L8.65 13.61 L8.71 13.27 L8.80 12.94 L8.90 12.60 L8.90 12.60 L8.79 12.94 L8.68 13.27 L8.58 13.59 L8.48 13.91 L8.40 14.23 L8.32 14.55 L8.26 14.87 L8.20 15.19 L8.15 15.51 L8.12 15.82 L8.10 16.14 L8.09 16.46 L8.09 16.79 L8.11 17.11 L8.15 17.43 L8.20 17.75 L8.28 18.07 L8.37 18.40 L8.47 18.71 L8.60 19.03 L8.75 19.34 L8.92 19.64 L9.10 19.94 L9.31 20.23 L9.53 20.51 L9.78 20.79 Z";

export function StreakMark({
  size = 16,
  color = C.accent,
  square = false,
}: {
  /** The flame's HEIGHT in px (its width follows STREAK_ASPECT). */
  size?: number;
  color?: string;
  /** Keep the original 24×24 box: only the animated version needs it, so
   *  its embers can be positioned in the same coordinate space. */
  square?: boolean;
}) {
  const vb = square
    ? "0 0 24 24"
    : `${INK.x} ${INK.y} ${INK.w} ${INK.h}`;
  return (
    <Svg
      width={square ? size : size * STREAK_ASPECT}
      height={size}
      viewBox={vb}
    >
      <Path fillRule="evenodd" fill={color} d={`${OUTER} ${SLIT_1} ${SLIT_2}`} />
    </Svg>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The celebration version for the streak dialog: the same mark, breathing,
 * with two embers rising out of it.
 *
 * This replaces the hand-authored Lottie (assets/flame.json). Keeping the
 * Lottie would have meant the dialog celebrating with a DIFFERENT flame from
 * the pill that opened it, and the whole point of drawing our own mark is
 * that there is only one. The motion keeps what the Lottie had that mattered:
 * a squash-and-stretch flicker and rising embers, both on the native driver.
 */
export function StreakMarkLive({ size = 118, color = C.warnAcc }: { size?: number; color?: string }) {
  const flicker = useRef(new Animated.Value(0)).current;
  const embers = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const rise = Animated.loop(
      Animated.timing(embers, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    breathe.start();
    rise.start();
    return () => {
      breathe.stop();
      rise.stop();
    };
  }, [flicker, embers]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [
            // Squash and stretch about the base, so the flame licks upward
            // instead of inflating like a balloon.
            { translateY: flicker.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.02] }) },
            { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            { scaleX: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
          ],
        }}
      >
        <StreakMark size={size} color={color} square />
      </Animated.View>

      {/* Two embers, half a cycle apart, drifting up and out. */}
      <Svg width={size} height={size} style={{ position: "absolute" }} viewBox="0 0 24 24">
        {[0, 0.5].map((phase, i) => {
          const shift = (v: number) => (v + phase) % 1;
          const range = [0, 0.25, 0.5, 0.75, 1];
          const t = embers.interpolate({
            inputRange: range,
            outputRange: range.map(shift),
          });
          return (
            <AnimatedCircle
              key={i}
              cx={i === 0 ? 9.2 : 15.2}
              r={i === 0 ? 0.85 : 0.7}
              fill={color}
              cy={t.interpolate({ inputRange: [0, 1], outputRange: [7.5, -1.5] })}
              opacity={t.interpolate({
                inputRange: [0, 0.25, 0.8, 1],
                outputRange: [0, 0.85, 0.2, 0],
              })}
            />
          );
        })}
      </Svg>
    </View>
  );
}
