/**
 * MOTION — the app's overlay timing, in one place (2026-08-10).
 *
 * It lives in `lib/` rather than `theme.ts` because theme.ts imports from
 * react-native, and these numbers are a promise worth testing in plain node.
 * `theme.ts` re-exports it, so components still read `MOTION` from the theme
 * with everything else.
 *
 * WHY THESE NUMBERS. Every overlay used to spring in with
 * `friction: 6, tension: 140`. Those are Origami units — RN maps them to
 * stiffness 592 / damping 19 before solving — so simulating RN's own
 * SpringAnimation gives a damping ratio of 0.39: the driving value overshot
 * its target by 26% — the card sprang past full size to ~104% and bounced
 * back — and kept ringing for 967 ms before RN's rest thresholds called it
 * done. It LOOKED settled well before that, but it was still moving, and
 * that is what "it takes time before I can press the buttons" actually is:
 * aiming at a control that is still travelling.
 *
 * Two rules replaced it:
 *
 *  - ENTER is 150 ms — nine frames at 60 fps. Long enough to read as motion,
 *    short enough that the first tap always lands.
 *  - The card barely MOVES (scale 0.96 -> 1). Distance travelled is what makes
 *    a target hard to hit: the old 0.85 start displaced a control near the
 *    dialog's edge by ~48 px, where 4% of a 320 px dialog is 6 px.
 *
 * EXIT is deliberately shorter than enter: dismissing is a decision already
 * made, and waiting on it is pure latency.
 */
export const MOTION = {
  /** Overlay entrance (ms). */
  enter: 150,
  /** Overlay dismissal (ms). */
  exit: 110,
  /** Sheets and full-screen overlays travel further, so they get longer. */
  sheet: 240,
  /** Small pills/badges popping in. */
  pop: 160,
  /** Card scale at the start of a centered modal's entrance. */
  scaleFrom: 0.96,
  /** Popovers are smaller, so 6% reads the same as 4% on a dialog. */
  popoverScaleFrom: 0.94,
} as const;
