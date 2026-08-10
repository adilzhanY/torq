/**
 * The overlay contract, pinned.
 *
 * Half of this asserts NUMBERS (an overlay has to be usable almost
 * immediately) and half asserts STRUCTURE (there is exactly one modal
 * implementation). The structural half is the one that earns its keep over
 * time: the app collected four bespoke `<Modal>` wrappers and two backdrops
 * before this was centralised, and nothing stopped it happening.
 */
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { MOTION } from "../motion";

/** The one file allowed to own modal mechanics. */
const SHELL = "components/CustomModal.tsx";

// Vite's raw glob rather than node:fs — `moduleResolution: bundler` with the
// react-native condition cannot resolve node builtins in this project, and
// the test should typecheck under the app's own tsconfig.
const raw = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files = Object.entries(raw)
  .map(([path, text]) => ({ rel: path.replace(/^\.\.\/\.\.\//, ""), text }))
  .filter((f) => !f.rel.includes("__tests__"));

describe("MOTION tokens", () => {
  it("opens fast enough that the first tap lands", () => {
    // 150 ms is nine frames. Anything past ~200 and you are aiming at a
    // moving control, which is the complaint this replaced.
    expect(MOTION.enter).toBeLessThanOrEqual(200);
    expect(MOTION.pop).toBeLessThanOrEqual(200);
    expect(MOTION.sheet).toBeLessThanOrEqual(300);
  });

  it("closes faster than it opens", () => {
    // Dismissal is a decision already made; waiting on it is pure latency.
    expect(MOTION.exit).toBeLessThan(MOTION.enter);
  });

  it("barely moves the card, so hit targets stay put", () => {
    // Distance travelled is what makes a target hard to hit. The old shell
    // started at 0.85 and displaced a control near the edge by ~48 px.
    expect(MOTION.scaleFrom).toBeGreaterThanOrEqual(0.95);
    expect(MOTION.popoverScaleFrom).toBeGreaterThanOrEqual(0.92);
    expect(MOTION.scaleFrom).toBeLessThan(1);
    expect(MOTION.popoverScaleFrom).toBeLessThan(1);
  });
});

describe("one modal implementation", () => {
  it("has a single shell file", () => {
    expect(files.some((f) => f.rel === SHELL)).toBe(true);
    // The old shell must be gone, not merely unused — two names for the
    // same thing is how the app ended up with two behaviours.
    expect(files.some((f) => f.rel === "components/Dialog.tsx")).toBe(false);
  });

  it("is the only file that touches react-native's Modal", () => {
    const offenders = files
      .filter((f) => f.rel !== SHELL)
      .filter((f) => /^\s*Modal,\s*$/m.test(f.text) || /\bfrom "react-native";[\s\S]{0,400}?<Modal\b/.test(f.text))
      .filter((f) => f.text.includes("<Modal"))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("leaves the scrim color defined once, in the theme", () => {
    const offenders = files
      .filter((f) => f.rel !== SHELL)
      .filter((f) => f.rel !== "theme.ts")
      .filter((f) => /"rgba\(0,\s*0,\s*0,/.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("leaves no overlay springing on the old ringing config", () => {
    // friction 6 / tension 140 is ζ = 0.39 — 26% overshoot, 967 ms to settle.
    const offenders = files
      .filter((f) => /Animated\.spring\([\s\S]{0,120}?friction:\s*6\b[\s\S]{0,40}tension:\s*140\b/.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("routes every screen's confirms and menus through the shell", () => {
    const users = files.filter((f) => /\b(CustomModal|ConfirmModal|AnchoredModal)\b/.test(f.text));
    // Every consumer imports them; none re-declares them.
    for (const f of users) {
      if (f.rel === SHELL) continue;
      expect(f.text).toMatch(/from "(\.\.\/)?(components\/)?\.?\/?CustomModal"|components\/CustomModal"/);
    }
    // Sanity: this is used widely, not in one place.
    expect(users.length).toBeGreaterThan(10);
  });
});
