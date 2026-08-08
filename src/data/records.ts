/**
 * World-record reference marks (PATH.md Phase 1, data half).
 *
 * IPF Classic (raw, no supportive equipment) world records for the three
 * competition lifts, per sex and weight class, in kilograms. Bundled and
 * versioned — never live-scraped (locked decision).
 *
 * ⚠ SNAPSHOT QUALITY: these values are an approximate snapshot of the IPF
 * classic records and are marked `verified: false`. Records break, and a
 * number shown next to a user's lift must be right, so re-check every row
 * against the official IPF record database (https://www.powerlifting.sport/
 * records) before the app ships publicly, then flip VERIFIED to true and
 * bump RECORDS_VERSION.
 */

export type RecordLift = "squat" | "bench" | "deadlift";

export const RECORDS_VERSION = "ipf-classic-2025.1";
export const RECORDS_VERIFIED = false;
export const RECORDS_SOURCE = "IPF Classic (raw) world records";

export interface RecordClass {
  /** Upper bound of the class in kg (Infinity for the super-heavyweight). */
  max: number;
  /** Class label as lifters know it ("83 kg", "120+ kg"). */
  label: string;
  squat: number;
  bench: number;
  deadlift: number;
}

export const RECORD_CLASSES: Record<"male" | "female", RecordClass[]> = {
  male: [
    { max: 59, label: "59 kg", squat: 245, bench: 158.5, deadlift: 289.5 },
    { max: 66, label: "66 kg", squat: 275.5, bench: 180.5, deadlift: 310 },
    { max: 74, label: "74 kg", squat: 303, bench: 200.5, deadlift: 340 },
    { max: 83, label: "83 kg", squat: 337.5, bench: 221.5, deadlift: 372.5 },
    { max: 93, label: "93 kg", squat: 375, bench: 236.5, deadlift: 390.5 },
    { max: 105, label: "105 kg", squat: 400.5, bench: 253.5, deadlift: 400 },
    { max: 120, label: "120 kg", squat: 420.5, bench: 261.5, deadlift: 420 },
    { max: Infinity, label: "120+ kg", squat: 490, bench: 280, deadlift: 440 },
  ],
  female: [
    { max: 47, label: "47 kg", squat: 158, bench: 92, deadlift: 191 },
    { max: 52, label: "52 kg", squat: 174, bench: 107.5, deadlift: 207.5 },
    { max: 57, label: "57 kg", squat: 195.5, bench: 115.5, deadlift: 227.5 },
    { max: 63, label: "63 kg", squat: 213, bench: 122.5, deadlift: 240.5 },
    { max: 69, label: "69 kg", squat: 226, bench: 134, deadlift: 251.5 },
    { max: 76, label: "76 kg", squat: 237, bench: 141, deadlift: 259 },
    { max: 84, label: "84 kg", squat: 247.5, bench: 148.5, deadlift: 270 },
    { max: Infinity, label: "84+ kg", squat: 267.5, bench: 162.5, deadlift: 285 },
  ],
};

export const LIFT_LABEL: Record<RecordLift, string> = {
  squat: "Squat",
  bench: "Bench press",
  deadlift: "Deadlift",
};
