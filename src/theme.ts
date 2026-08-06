/**
 * Torq design tokens — the CARDLESS rebrand system (2026-08-06): near-black
 * page, lime accent, Space Grotesk. Content sits directly on the page —
 * hierarchy from type scale/weight/color steps (ink → inkSoft → inkFaint)
 * and whitespace, hairline dividers where separation is needed. Surfaces
 * (C.surface + C.line border) are reserved for INTERACTIVE elements and
 * true overlays. The old clay/bento palette is gone.
 */
import { Platform, type ViewStyle } from "react-native";

export const C = {
  page: "#0E0F0E",
  /** Backing for inputs and pressed states. */
  page2: "#1B1E1A",
  /** Interactive surfaces + overlays only (dialogs, sheets, dock, top bar). */
  surface: "#151714",
  ink: "#F2F4EE",
  inkSoft: "#9AA294",
  inkFaint: "#5C6356",
  /** Border on surfaces (dialogs, dock, inputs). */
  line: "#262A24",
  /** Hairline divider on the bare page. */
  hair: "#22261F",

  // Brand: the logo's dark square + lime vortex mark.
  primary: "#1A1B1A",
  primaryDeep: "#101110",
  accent: "#C8FE23",
  /** Text/icon color on top of the (light) lime accent. */
  accentInk: "#1A1B1A",

  goodSurf: "#152A22",
  goodAcc: "#5AC8A0",
  warnSurf: "#2A2113",
  warnAcc: "#F0A742",
  badSurf: "#2B1715",
  badAcc: "#E06A5A",
  prSurf: "#211B33",
  prAcc: "#9C86E8",
  gold: "#E9B920",

  // Chart palette (light-on-dark)
  chart1: "#F2F4EE",
  chart2: "#5AC8A0",
  chart3: "#F0A742",
  chart4: "#9C86E8",
  chart5: "#C8FE23",
} as const;

export const R = { lg: 28, md: 22, sm: 16, pill: 999 } as const;

/**
 * Distance from the screen top to below the floating top bar (8 gap +
 * 52 bar). Tab screens and in-tab overlays add their own padding on top
 * of this; content scrolls under the bar.
 */
export const TOP_BAR_SPACE = 60;

/** Letter + color for non-normal set types (Strong-style W/D/F badges). */
export const SET_TYPE_META = {
  warmup: { letter: "W", color: C.warnAcc, label: "Warm up" },
  drop: { letter: "D", color: C.prAcc, label: "Drop set" },
  failure: { letter: "F", color: C.badAcc, label: "Failure" },
} as const;

export const FONT = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  semibold: "SpaceGrotesk_600SemiBold",
  bold: "SpaceGrotesk_700Bold",
  // Space Grotesk tops out at 700 — extrabold shares Bold.
  extrabold: "SpaceGrotesk_700Bold",
} as const;

/** Soft raised shadow — only for floating interactive surfaces/overlays. */
export function clay(): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    default: {},
  })!;
}

/** Smaller shadow for chips/buttons. */
export function claySm(): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  })!;
}
