/**
 * Torq design tokens — the clay/bento system ported from grit's mobile app.
 * Same palette, radii, and type scale. RN can't do a layered inset clay
 * shadow, so `clay()` and `claySm()` approximate it with one soft elevation.
 */
import { Platform, type ViewStyle } from "react-native";

export const C = {
  page: "#f1efe9",
  page2: "#e9e7df",
  surface: "#faf9f5",
  ink: "#1b211f",
  inkSoft: "#4b5650",
  inkFaint: "#76817b",

  primary: "#272d29",
  primaryDeep: "#161a17",
  accent: "#f97316",

  goodSurf: "#d4f3ec",
  goodAcc: "#0b7d72",
  warnSurf: "#fff0d6",
  warnAcc: "#c2700a",
  badSurf: "#ffe0dd",
  badAcc: "#cf3b3f",
  prSurf: "#e9e2ff",
  prAcc: "#6d4fe0",
  gold: "#e0a500",

  // Chart palette
  chart1: "#272d29",
  chart2: "#0b7d72",
  chart3: "#c2700a",
  chart4: "#6d4fe0",
  chart5: "#f97316",
} as const;

export const R = { lg: 28, md: 22, sm: 16, pill: 999 } as const;

export const FONT = {
  regular: "Onest_400Regular",
  medium: "Onest_500Medium",
  semibold: "Onest_600SemiBold",
  bold: "Onest_700Bold",
  extrabold: "Onest_800ExtraBold",
} as const;

/** Soft raised clay shadow. */
export function clay(): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#141a18",
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    default: {},
  })!;
}

/** Smaller clay shadow for chips/buttons. */
export function claySm(): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#141a18",
      shadowOffset: { width: 2, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 7,
    },
    android: { elevation: 2 },
    default: {},
  })!;
}
