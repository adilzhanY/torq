/**
 * CustomModal — the app's ONE overlay primitive (2026-08-10, Adilzhan: "now
 * it opens good, but slowly, and it takes time for me to be able to actually
 * press on buttons there").
 *
 * Three shells, one motion language, one dismissal story:
 *
 *   CustomModal    centered dialog (menus, confirms, editors, pickers)
 *   ConfirmModal   the ready-made destructive confirmation
 *   AnchoredModal  popover pinned under the button that opened it
 *
 * WHY IT FELT SLOW, simulated rather than guessed. The old shell sprang in
 * with `friction: 6, tension: 140`; running those through RN's own Origami
 * mapping and spring solver gives a damping ratio of 0.39, a 26% overshoot
 * on the driving value (the card springs past full size to ~104%) and 967 ms
 * before the rest thresholds stop it. On top of that the card
 * started at 85% scale, so a control near the dialog's edge sat ~48 px from
 * where it would end up. You were aiming at a moving target for a second.
 * See MOTION (lib/motion.ts, re-exported by the theme) for the replacement.
 *
 * WHAT MAKES IT PRESSABLE IMMEDIATELY, and these are structural, not tuning:
 *  - the card's LAYOUT is final from the first frame; only a 4% transform
 *    animates, so a hit target is never more than a few px from its resting
 *    place, and it settles in 150 ms;
 *  - nothing is ever `pointerEvents: none` on the card, so a tap on frame 1
 *    is handled on frame 1;
 *  - the entrance is a TIMING, so it actually finishes — there is no long
 *    invisible tail still owning the view.
 *
 * The centered shells are inline absolute overlays, NOT react-native Modals
 * (those clip on this emulator — a bug this project has hit twice). Mount
 * them inside a flex-1 screen root. AnchoredModal is the exception and DOES
 * use a Modal, because a popover has to escape its parent's clipping; it
 * keeps `statusBarTranslucent` so page coordinates line up with the
 * edge-to-edge app window.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  View,
  type ViewStyle,
} from "react-native";
import { C, MOTION } from "../theme";
import { Icon } from "./Icon";
import { Surface, Txt } from "./ui";

const ModalCloseCtx = createContext<() => void>(() => {});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The animated close of the enclosing modal, so a child can dismiss with the
 * exit animation instead of yanking itself out of the tree.
 *
 * GOTCHA worth knowing before you use it: this reads a context the modal
 * PROVIDES, so calling it in the component that renders the modal is outside
 * the provider and silently gets the no-op fallback. Put buttons that close
 * the modal in their own child component (ConfirmButtons below is the
 * pattern).
 */
export function useModalClose(): () => void {
  return useContext(ModalCloseCtx);
}

/**
 * Drives one overlay's enter/exit on the native driver and hands back an
 * animated close. Shared by every shell in this file so they cannot drift.
 */
function useOverlayAnim(onClose: () => void, enter = MOTION.enter) {
  const v = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: enter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, enter]);

  const close = useCallback(() => {
    if (closing.current) return; // a double-tap must not queue two exits
    closing.current = true;
    Animated.timing(v, {
      toValue: 0,
      duration: MOTION.exit,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
      else closing.current = false;
    });
  }, [v, onClose]);

  return { v, close };
}

/**
 * Hardware Back dismisses the top-most overlay. Registered on mount, so a
 * modal opened over a screen that has its own back handler wins — Android
 * runs these newest-first and ours returns true, which is exactly right: the
 * thing on top is what Back should close.
 */
function useBackToClose(close: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close, enabled]);
}

/**
 * The dim, on its own, for overlays that bring their own body — bottom
 * sheets anchored above the keyboard, mostly. Same fade and same color as
 * the one inside CustomModal, so a sheet and a dialog dim identically.
 */
export function ModalBackdrop({
  onPress,
  color = C.scrim,
}: {
  onPress?: () => void;
  color?: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: MOTION.enter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: color,
        opacity: v,
      }}
    />
  );
}

/** Icon + label row for modal menus (workout ⋯, routine ⋯…). */
export function MenuRow({
  icon,
  label,
  color = C.ink,
  disabled,
  onPress,
}: {
  icon: string;
  label: string;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon name={icon} size={18} color={color} />
      <Txt size={14} weight="semibold" color={color}>{label}</Txt>
    </Pressable>
  );
}

/**
 * The centered dialog. `dismissable={false}` blocks both the backdrop tap
 * and hardware Back, for the rare modal that must be answered.
 */
export function CustomModal({
  onClose,
  children,
  dismissable = true,
}: {
  onClose: () => void;
  children: ReactNode;
  dismissable?: boolean;
}) {
  const { v, close } = useOverlayAnim(onClose);
  useBackToClose(close, dismissable);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* The dim leads the card: full black by 60% of the entrance (~90 ms),
          so the screen behind is out of the way before the card lands. One
          animated value still drives both. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: C.scrim,
          opacity: v.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 1, 1],
            extrapolate: "clamp",
          }),
        }}
      />
      <Pressable
        style={{ flex: 1, justifyContent: "center", padding: 16 }}
        onPress={dismissable ? close : undefined}
      >
        <Animated.View
          accessibilityViewIsModal
          style={{
            opacity: v,
            transform: [
              {
                scale: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [MOTION.scaleFrom, 1],
                  extrapolate: "clamp",
                }),
              },
            ],
          }}
        >
          {/* Swallow taps inside the card so they don't reach the backdrop. */}
          <Pressable onPress={() => {}}>
            <ModalCloseCtx.Provider value={close}>
              <Surface style={{ gap: 12 }}>{children}</Surface>
            </ModalCloseCtx.Provider>
          </Pressable>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Popover pinned to whatever opened it. Positioning stays with the caller
 * (`style` places it, exactly as before) because the four call sites anchor
 * differently; what this owns is the Modal wrapper, the tap-outside close,
 * the status-bar alignment and the animation.
 */
export function AnchoredModal({
  open,
  onClose,
  children,
  style,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Modal
      visible={open}
      transparent
      // Align the modal window with the edge-to-edge app window: without
      // this it starts below the status bar and every pageY-anchored
      // position lands ~a status bar too low.
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        {open ? <PopoverBody style={style}>{children}</PopoverBody> : null}
      </Pressable>
    </Modal>
  );
}

/** Split out so the entrance restarts whenever the popover reopens. */
function PopoverBody({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: MOTION.enter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [MOTION.popoverScaleFrom, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Its own component so `useModalClose()` sits inside the provider. */
function ConfirmButtons({
  confirmLabel,
  onConfirm,
}: {
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const close = useModalClose();
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 22, marginTop: 2 }}>
      <Pressable hitSlop={8} onPress={close}>
        <Txt size={14} weight="bold" color={C.inkFaint}>Cancel</Txt>
      </Pressable>
      <Pressable
        hitSlop={8}
        onPress={() => {
          onConfirm();
          close();
        }}
      >
        <Txt size={14} weight="extrabold" color={C.badAcc}>{confirmLabel}</Txt>
      </Pressable>
    </View>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <CustomModal onClose={onClose}>
      <Txt size={18} weight="extrabold">{title}</Txt>
      {message ? <Txt size={13} color={C.inkSoft}>{message}</Txt> : null}
      <ConfirmButtons confirmLabel={confirmLabel} onConfirm={onConfirm} />
    </CustomModal>
  );
}
