/** Shared UI primitives: the clay card, pills, fields, buttons, text. */
import React from "react";
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { C, FONT, R, clay, claySm } from "../theme";
import { Squish } from "./anim";

export function Txt({
  children,
  style,
  weight = "medium",
  size = 14,
  color = C.ink,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: keyof typeof FONT;
  size?: number;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: FONT[weight], fontSize: size, color }, style]}
    >
      {children}
    </Text>
  );
}

/**
 * PageTitle: the heading at the top of every screen, defined ONCE.
 *
 * Before this existed the app shipped five different sizes for the same
 * thing: 30 on Home, 26 on History/Workout/Ranks/Stats/Profile/Settings,
 * 24 on sub-pages and 22 on the exercise browser. Nobody chose that; it
 * accumulated. One component means it can never drift again.
 *
 * `includeFontPadding: false` is part of the definition, not decoration:
 * Android pads a Text's line box above the caps, and anything centred
 * beside a title (the streak pill on Home) gets centred on that padding
 * and rides high.
 */
export function PageTitle({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Txt
      size={26}
      weight="extrabold"
      numberOfLines={numberOfLines}
      style={[{ letterSpacing: -0.6, includeFontPadding: false }, style]}
    >
      {children}
    </Txt>
  );
}

/**
 * CARDLESS: a content block, not a box. Transparent by default, content
 * sits directly on the page; only the old padding survives so layouts keep
 * their gutters. Passing an explicit `background` (dialog bodies, the odd
 * deliberate dark panel) restores a bordered surface. For interactive
 * floating surfaces use `Surface`.
 */
export function Card({
  children,
  style,
  background = "transparent",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  background?: string;
}) {
  const surfaced = background !== "transparent";
  return (
    <View
      style={[
        surfaced
          ? {
              backgroundColor: background,
              borderRadius: R.md,
              padding: 16,
              borderWidth: 1,
              borderColor: C.line,
            }
          : { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The old card look: reserved for overlays and floating interactive UI. */
export function Surface({
  children,
  style,
  background = C.surface,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  background?: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: R.lg,
          padding: 16,
          borderWidth: 1,
          borderColor: C.line,
        },
        clay(),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Tiny uppercase section label: the cardless replacement for boxes. */
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Txt
      size={10}
      weight="semibold"
      color={C.inkFaint}
      style={[
        { textTransform: "uppercase", letterSpacing: 1.4, marginTop: 18, marginBottom: 6 },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}

export function Pill({
  text,
  color = C.ink,
  bg = C.page2,
}: {
  text: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: R.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Txt size={12} weight="extrabold" color={color}>
        {text}
      </Txt>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt
      size={12}
      weight="bold"
      color={C.inkFaint}
      style={{ textTransform: "uppercase", letterSpacing: 1 }}
    >
      {children}
    </Txt>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  background = C.accent,
  color = C.accentInk,
  large,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  background?: string;
  color?: string;
  /** Chunky primary CTA (Finish workout): taller with bigger type. */
  large?: boolean;
}) {
  return (
    <Squish
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: background,
          borderRadius: R.ctrl,
          paddingHorizontal: 20,
          paddingVertical: large ? 15 : 11,
          opacity: disabled ? 0.4 : 1,
          alignItems: "center",
        },
        claySm(),
      ]}
    >
      <Txt size={large ? 15.5 : undefined} weight={large ? "extrabold" : "bold"} color={color}>
        {label}
      </Txt>
    </Squish>
  );
}

export const NumberField = React.forwardRef<
  TextInput,
  {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    suffix?: string;
    width?: number;
    placeholder?: string;
    /** Tighter vertical padding (dense rows like the live set logger). */
    compact?: boolean;
    /** Center the digits (narrow fixed-width fields). */
    center?: boolean;
    autoFocus?: boolean;
    selectTextOnFocus?: boolean;
    onBlur?: () => void;
  }
>(function NumberField(
  {
    label,
    value,
    onChange,
    suffix,
    width,
    placeholder = "0",
    compact,
    center,
    autoFocus,
    selectTextOnFocus,
    onBlur,
  },
  ref,
) {
  // While focused the field shows exactly what was typed. The parent stores
  // a parsed NUMBER and echoes it back as `value`, so without this a typed
  // "1," re-rendered as "1" and the comma vanished under the thumb (and an
  // unparseable draft used to blank the field entirely).
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <View style={{ gap: 4, width }}>
      {label ? (
        <Txt size={12} weight="bold" color={C.inkSoft}>
          {label}
        </Txt>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: C.page2,
          borderRadius: R.sm,
          // Hairline border so a field reads as a box on the bare page
          // (the live-session KG/REPS cells in the sharp-10 mock).
          borderWidth: 1,
          borderColor: C.line,
          paddingHorizontal: center ? 6 : 12,
          paddingVertical: compact ? 5 : 8,
        }}
      >
        <TextInput
          ref={ref}
          value={draft ?? value}
          onChangeText={(t) => {
            setDraft(t);
            onChange(t);
          }}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={C.inkFaint}
          autoFocus={autoFocus}
          selectTextOnFocus={selectTextOnFocus}
          onBlur={() => {
            setDraft(null);
            onBlur?.();
          }}
          style={{
            flex: 1,
            fontFamily: FONT.semibold,
            fontSize: 14,
            color: C.ink,
            padding: 0,
            textAlign: center ? "center" : "left",
          }}
        />
        {suffix ? (
          <Txt size={12} weight="medium" color={C.inkFaint}>
            {suffix}
          </Txt>
        ) : null}
      </View>
    </View>
  );
});

export function TextField({
  value,
  onChange,
  placeholder,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.inkFaint}
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
      returnKeyType="done"
      style={{
        backgroundColor: C.page2,
        borderRadius: R.sm,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontFamily: FONT.semibold,
        fontSize: 14,
        color: C.ink,
      }}
    />
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.hair }} />;
}
