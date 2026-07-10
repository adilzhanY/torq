/**
 * Animation primitives (ported from grit mobile):
 *  - Collapsible → smooth expand/collapse
 *  - PopIn      → modal/pill entrance
 *  - FloatUp    → one-shot "+N" float
 *  - Squish     → pressable clay squish
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View, type ViewStyle } from "react-native";

/** Smooth expand/collapse by animating height. */
export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [measured, setMeasured] = useState(0);
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(h, {
      toValue: open ? measured : 0,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, measured, h]);
  return (
    <Animated.View style={{ height: measured ? h : undefined, overflow: "hidden" }}>
      <View
        style={{ position: "absolute", left: 0, right: 0 }}
        onLayout={(e) => setMeasured(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * One-shot mount entrance: the content grows in from zero height while
 * fading and sliding up a touch, then the clip is released so later layout
 * changes inside aren't constrained. Height is measured off the first
 * layout pass (the child keeps its natural height inside the 0-height
 * clipped parent), so it works for any content.
 */
export function GrowIn({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const height = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);
  const [settled, setSettled] = useState(false);

  return (
    <Animated.View style={settled ? undefined : { height, opacity: fade, overflow: "hidden" }}>
      {/* Absolute while animating (same trick as Collapsible): the child
          would collapse to 0 inside the 0-height clip otherwise, so it
          could never report its natural height. Back to normal flow once
          settled so the parent tracks later size changes. */}
      <Animated.View
        style={[
          style,
          settled
            ? undefined
            : {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: [
                  {
                    translateY: fade.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
        ]}
        onLayout={(e) => {
          if (measured.current) return;
          const h = e.nativeEvent.layout.height;
          if (!h) return;
          measured.current = true;
          Animated.parallel([
            Animated.timing(height, {
              toValue: h,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
            Animated.timing(fade, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ]).start(({ finished }) => {
            if (finished) setSettled(true);
          });
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Spring scale+fade in — the modal/pill entrance. */
export function PopIn({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Slides its content up from below on mount (bottom-sheet entrance). */
export function SlideUp({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 10, tension: 120 }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A one-shot "+N" that floats up and fades (keyed remount restarts it). */
export function FloatUp({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that squishes on press (the clay-press feel). */
export function Squish({
  children,
  onPress,
  disabled,
  style,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  hitSlop?: number;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (val: number) =>
    Animated.spring(v, { toValue: val, useNativeDriver: true, friction: 7, tension: 220 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[style as ViewStyle, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
