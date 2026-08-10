/**
 * Keyboard handling (Adilzhan, 2026-08-08: "the keyboard covers the input
 * and I can't see what I'm typing").
 *
 * Deliberately dependency-free. The polished answer is
 * react-native-keyboard-controller, but it is NOT in Expo Go (checked in
 * the SDK 57 keyboard guide) and adopting it would cost the emulator dev
 * loop that run_android.sh depends on. This does the same job with the
 * built-in Keyboard module.
 *
 * The approach is deliberately MEASUREMENT-BASED rather than layout-based,
 * because Android's behaviour varies: under edge-to-edge the window may
 * resize, may pan, or may do neither depending on version and config. So
 * instead of assuming, we ask where the focused input actually ended up on
 * screen once the keyboard is open, and scroll only if it is genuinely
 * covered. If the OS already moved it into view, our correction is zero and
 * nothing fights anything.
 *
 * The one layout change is extra bottom padding while the keyboard is up,
 * which exists so the LAST input on a screen has somewhere to scroll to.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  ScrollView,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

/** Height of the on-screen keyboard, 0 when hidden. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // "DidShow" rather than "WillShow": Android only fires the Did* events.
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Breathing room between the focused field and the top of the keyboard. */
const GAP = 24;

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  /** Extra space to keep under the focused input (a footer, a CTA…). */
  bottomOffset?: number;
}

/**
 * A ScrollView that keeps the focused TextInput visible above the keyboard.
 * Drop-in replacement: same props.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    { children, contentContainerStyle, bottomOffset = 0, onScroll, scrollEventThrottle, ...rest },
    ref,
  ) {
    const inner = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => inner.current as ScrollView);
    const offset = useRef(0);
    const [kb, setKb] = useState(0);

    useEffect(() => {
      const show = Keyboard.addListener("keyboardDidShow", (e) => {
        const kbHeight = e.endCoordinates?.height ?? 0;
        setKb(kbHeight);

        const input = TextInput.State.currentlyFocusedInput();
        if (!input || !inner.current) return;
        // Measure AFTER the keyboard is up, so this reflects whatever the OS
        // already did to the window (resize, pan, or nothing).
        input.measureInWindow((_x, y, _w, h) => {
          if (y == null || Number.isNaN(y)) return;
          const screenH = Dimensions.get("window").height;
          const keyboardTop = screenH - kbHeight - bottomOffset;
          const inputBottom = y + h + GAP;
          const covered = inputBottom - keyboardTop;
          if (covered <= 0) return; // already visible, do nothing
          inner.current?.scrollTo({ y: Math.max(0, offset.current + covered), animated: true });
        });
      });
      const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
      return () => {
        show.remove();
        hide.remove();
      };
    }, [bottomOffset]);

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    };

    return (
      <ScrollView
        ref={inner}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        // Tapping a button while an input is focused should press the button,
        // not just dismiss the keyboard and swallow the tap.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          contentContainerStyle,
          // Headroom so the LAST field on a screen can still scroll clear of
          // the keyboard. Harmless if the OS also resized the window.
          kb > 0 ? { paddingBottom: kb + GAP } : null,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  },
);
