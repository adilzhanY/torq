/**
 * Shared centered dialog — the app's one modal pattern (dim backdrop,
 * PopIn card in the middle, tap-outside dismisses). Inline absolute
 * overlay, NOT a react-native Modal (Modals clip on the emulator).
 * Mount it inside a flex-1 screen root so it covers the whole screen.
 *
 * `CenterDialog` is the shell; `ConfirmDialog` is the ready-made
 * destructive-action confirmation built on it.
 */
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { PopIn } from "./anim";
import { Card, Txt } from "./ui";

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
  return (
    <Pressable
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(20,26,24,0.4)",
        justifyContent: "center",
        padding: 16,
      }}
      onPress={onClose}
    >
      <PopIn>
        {/* Swallow taps inside the card so they don't dismiss. */}
        <Pressable onPress={() => {}}>
          <Card style={{ gap: 12 }}>{children}</Card>
        </Pressable>
      </PopIn>
    </Pressable>
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
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 22, marginTop: 2 }}>
        <Pressable hitSlop={8} onPress={onClose}>
          <Txt size={14} weight="bold" color={C.inkFaint}>Cancel</Txt>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => {
            onConfirm();
            onClose();
          }}
        >
          <Txt size={14} weight="extrabold" color={C.badAcc}>{confirmLabel}</Txt>
        </Pressable>
      </View>
    </CenterDialog>
  );
}
