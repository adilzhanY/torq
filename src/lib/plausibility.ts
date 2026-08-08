/**
 * Plausibility caps (PATH.md: "the Liftoff lesson" — never trust a number
 * you publish to other people).
 *
 * Two jobs, in this order of frequency:
 *  1. TYPOS. A 1000 kg squat is almost always a missed decimal point, and
 *     silently ranking it as World Class makes the whole ladder look broken
 *     to the person who mistyped it.
 *  2. Cheating. Friends-first visibility already does most of the work, but
 *     a lift above the world record for your weight class has no business
 *     being published to anyone.
 *
 * The cap applies ONLY to what leaves the device. Your own logs and your own
 * Ranks screen keep showing exactly what you typed — this is not a judgement
 * on your training, just a filter on what other people are shown.
 */
import { dotsPoints } from "./rank";
import { recordLiftOf, worldRecord } from "./records";
import type { Equipment } from "./../types";

/**
 * Ceiling for exercises with no official record, expressed in DOTS. The
 * per-lift ladder tops out at 165 (World Class); raw deadlift world records
 * sit near 130–140 DOTS, so 200 clears every real human by a wide margin
 * and still catches a decimal-point slip.
 */
export const MAX_DOTS = 200;

export interface PlausibilityCheck {
  ok: boolean;
  /** Why it was rejected, ready to show. Null when ok. */
  reason: string | null;
}

/**
 * Is this estimated 1RM believable for this person?
 *
 * For the three competition lifts we compare against the world record in
 * their weight class — no margin: an e1RM above the WR is not a claim we
 * republish. Everything else falls back to the DOTS ceiling.
 */
export function checkLift(
  name: string,
  equipment: Equipment,
  e1RMkg: number,
  bodyweightKg: number,
  sex: "male" | "female",
): PlausibilityCheck {
  if (!(e1RMkg > 0)) return { ok: false, reason: "No weight logged." };

  const lift = recordLiftOf(name, equipment);
  if (lift) {
    const wr = worldRecord(lift, sex, bodyweightKg);
    if (wr && e1RMkg > wr.kg) {
      return {
        ok: false,
        reason: `Above the ${wr.className} world record (${wr.kg} kg) — check for a typo.`,
      };
    }
  }

  if (dotsPoints(e1RMkg, bodyweightKg, sex) > MAX_DOTS) {
    return { ok: false, reason: "Beyond any recorded human lift — check for a typo." };
  }
  return { ok: true, reason: null };
}
