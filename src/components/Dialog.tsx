/**
 * Shared centered dialog — the app's one modal pattern (dim backdrop,
 * springs in, animates OUT on backdrop tap before unmounting). Inline
 * absolute overlay, NOT a react-native Modal (Modals clip on the
 * emulator). Mount it inside a flex-1 screen root so it covers the whole
 * screen.
 *
 * `CenterDialog` is the shell; `ConfirmDialog` is the ready-made
 * destructive-action confirmation built on it. Children that close the
 * dialog themselves can grab the animated close via `useDialogClose()`
 * instead of calling the parent's onClose directly.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { Card, Txt } from "./ui";

const DialogCloseCtx = createContext<() => void>(() => {});

/** Animated close of the enclosing CenterDialog (falls back to no-op). */
export function useDialogClose(): () => void {
  return useContext(DialogCloseCtx);
}

/** Icon + label row for CenterDialog menus (workout ⋯, routine ⋯…). */
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

export function CenterDialog({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [v]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(v, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
      else closing.current = false;
    });
  };

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* Backdrop dims in and out with the card */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: "rgba(20,26,24,0.4)",
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
        }}
      />
      <Pressable
        style={{ flex: 1, justifyContent: "center", padding: 16 }}
        onPress={close}
      >
        <Animated.View
          style={{
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          }}
        >
          {/* Swallow taps inside the card so they don't dismiss. */}
          <Pressable onPress={() => {}}>
            <DialogCloseCtx.Provider value={close}>
              <Card style={{ gap: 12 }}>{children}</Card>
            </DialogCloseCtx.Provider>
          </Pressable>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function ConfirmButtons({
  confirmLabel,
  onConfirm,
}: {
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const close = useDialogClose();
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

export function ConfirmDialog({
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
    <CenterDialog onClose={onClose}>
      <Txt size={18} weight="extrabold">{title}</Txt>
      {message ? (
        <Txt size={13} color={C.inkSoft}>{message}</Txt>
      ) : null}
      <ConfirmButtons confirmLabel={confirmLabel} onConfirm={onConfirm} />
    </CenterDialog>
  );
}
