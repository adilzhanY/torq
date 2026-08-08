/**
 * World-record mentions (PATH.md Phase 1): map a library exercise onto one
 * of the three competition lifts, then look up the record for the user's
 * sex and weight class so the rank page can say "you are at 41% of the
 * 83 kg world record".
 *
 * Matching is deliberately STRICT — only the plain barbell competition
 * movement counts. An incline bench or a front squat is a different lift
 * and gets no record line rather than a misleading one.
 */
import {
  LIFT_LABEL,
  RECORDS_CHECKED_AT,
  RECORDS_SOURCE,
  RECORDS_VERSION,
  RECORD_CLASSES,
  type RecordClass,
  type RecordLift,
} from "../data/records";
import type { Equipment } from "../types";

export { LIFT_LABEL, RECORDS_CHECKED_AT, RECORDS_SOURCE, RECORDS_VERSION };
export type { RecordLift };

/** Words that turn a competition lift into a variation (→ no record). */
const EXCLUDE: Record<RecordLift, RegExp> = {
  squat:
    /front|goblet|split|bulgarian|hack|jump|sissy|zercher|overhead|box|pistol|smith|belt|bodyweight|single|one leg|hindu|sumo squat|wall|jerk|frankenstein|on knees|jefferson|bench squat|pure/,
  bench:
    /incline|decline|close|wide|reverse|floor|smith|dumbbell|machine|guillotine|larsen|spoto|pause|board|\bjm\b/,
  deadlift:
    /romanian|stiff|straight|deficit|rack|snatch|single|one arm|side deadlift|trap|hex|dumbbell|smith|band|good ?morning|jefferson|suitcase/,
};

const MATCH: Record<RecordLift, RegExp> = {
  squat: /\bsquat/,
  bench: /bench press/,
  deadlift: /deadlift/,
};

/**
 * The competition lift an exercise counts as, or null. Barbell-only: the
 * records are barbell records.
 */
export function recordLiftOf(name: string, equipment: Equipment): RecordLift | null {
  if (equipment !== "barbell") return null;
  const n = name.toLowerCase();
  for (const lift of ["squat", "bench", "deadlift"] as RecordLift[]) {
    if (MATCH[lift].test(n) && !EXCLUDE[lift].test(n)) return lift;
  }
  return null;
}

function classFor(sex: "male" | "female", bodyweightKg: number): RecordClass {
  const rows = RECORD_CLASSES[sex];
  return rows.find((r) => bodyweightKg <= r.max) ?? rows[rows.length - 1];
}

export interface WorldRecord {
  lift: RecordLift;
  /** Record weight in kg. */
  kg: number;
  /** Who holds it. */
  holder: string;
  /** Weight-class label the record belongs to. */
  className: string;
}

/**
 * The record for this lift in the user's sex + weight class, or null when
 * that cell isn't curated yet (no line beats a wrong line).
 */
export function worldRecord(
  lift: RecordLift,
  sex: "male" | "female",
  bodyweightKg: number,
): WorldRecord | null {
  const row = classFor(sex, bodyweightKg);
  const cell = row[lift];
  return cell ? { lift, kg: cell.kg, holder: cell.holder, className: row.label } : null;
}

/** Share of the record a lift represents, 0..1 (clamped at 1). */
export function recordShare(liftKg: number, recordKg: number): number {
  if (recordKg <= 0) return 0;
  return Math.min(1, Math.max(0, liftKg / recordKg));
}
