/**
 * World-record reference marks (PATH.md Phase 1, data half).
 *
 * IPF Classic (raw) world records for the three competition lifts, per sex
 * and weight class, in kilograms. Bundled and versioned, never
 * live-scraped (locked decision).
 *
 * FRESHNESS WARNING: records move. Searching in 2026-08 turned up several
 * 2025/2026 records that postdate the source below (e.g. a 47 kg women's
 * squat of 166 kg), so treat every value here as a dated SNAPSHOT and
 * re-verify against the official IPF database before a public release.
 *
 * PROVENANCE: transcribed 2026-08-08 from the published record tables at
 * garagegymreviews.com/powerlifting-records (men: all three lifts; women:
 * bench and deadlift), plus the women's 84 kg squat from the 2026 SBD
 * Sheffield reports of Amanda Lawrence's 250.5 kg. That source's women's
 * squat table is a duplicate of its bench table, so the remaining women's
 * squat classes are `null`.
 *
 * TWO ATTEMPTS TO FILL THEM HAVE FAILED, both rejected on purpose:
 *  1. The OpenPowerlifting dump: "best result ever recorded" is not a
 *     ratified record (its per-class maxima run well above published
 *     records because they include every division and unratified lifts).
 *  2. Secondary aggregator pages: the one that looked like a complete
 *     table states outright that its values are "approximate", with no
 *     holders and no dates.
 * Filling these needs the official IPF record database
 * (https://www.powerlifting.sport/records), which is not machine-readable
 * from here. Until then the app SAYS the record is missing rather than
 * showing nothing, so the gap reads as our gap and not as "this lift has
 * no record".
 */

export type RecordLift = "squat" | "bench" | "deadlift";

export const RECORDS_VERSION = "ipf-classic-2026.1";
export const RECORDS_CHECKED_AT = "2026-08-08";
export const RECORDS_SOURCE = "IPF Classic (raw) world records";

/** One record: the weight in kg and who holds it. `null` = not curated. */
export type RecordCell = { kg: number; holder: string } | null;

export interface RecordClass {
  /** Upper bound of the class in kg (Infinity for the super-heavyweight). */
  max: number;
  /** Class label as lifters know it ("83 kg", "120+ kg"). */
  label: string;
  squat: RecordCell;
  bench: RecordCell;
  deadlift: RecordCell;
}

export const RECORD_CLASSES: Record<"male" | "female", RecordClass[]> = {
  male: [
    {
      max: 59,
      label: "59 kg",
      squat: { kg: 240, holder: "Kevin Gray" },
      bench: { kg: 171, holder: "Sergei Fedosienko" },
      deadlift: { kg: 275, holder: "Derek Ng" },
    },
    {
      max: 66,
      label: "66 kg",
      squat: { kg: 271, holder: "Jonathan Garcia" },
      bench: { kg: 213.5, holder: "Eddie Berglund" },
      deadlift: { kg: 298, holder: "Hassan El Belghiti" },
    },
    {
      max: 74,
      label: "74 kg",
      squat: { kg: 283, holder: "Taylor Atwood" },
      bench: { kg: 211.5, holder: "Daiki Kodama" },
      deadlift: { kg: 322, holder: "Kjell Egil Bakkelund" },
    },
    {
      max: 83,
      label: "83 kg",
      squat: { kg: 320.5, holder: "Russel Orhii" },
      bench: { kg: 218.5, holder: "Owen Hubbard" },
      deadlift: { kg: 362.5, holder: "Asein Enahoro" },
    },
    {
      max: 93,
      label: "93 kg",
      squat: { kg: 331, holder: "Anatolii Novopismennyi" },
      bench: { kg: 238.5, holder: "Jonathan Cayco" },
      deadlift: { kg: 373.5, holder: "Chance Mitchell" },
    },
    {
      max: 105,
      label: "105 kg",
      squat: { kg: 360, holder: "Anatolii Novopismennyi" },
      bench: { kg: 233.5, holder: "Rene Caky" },
      deadlift: { kg: 390.5, holder: "Krzysztof Wierzbicki" },
    },
    {
      max: 120,
      label: "120 kg",
      squat: { kg: 386, holder: "Dennis Cornelius" },
      bench: { kg: 253, holder: "Dennis Cornelius" },
      deadlift: { kg: 385.5, holder: "Bryce Krawczyk" },
    },
    {
      max: Infinity,
      label: "120+ kg",
      squat: { kg: 477.5, holder: "Ray Williams" },
      bench: { kg: 291.5, holder: "Ilyas Boughalem" },
      deadlift: { kg: 398.5, holder: "Ray Williams" },
    },
  ],
  female: [
    {
      max: 47,
      label: "47 kg",
      squat: null,
      bench: { kg: 96, holder: "Tiffany Chapon" },
      deadlift: { kg: 185, holder: "Heather Connor" },
    },
    {
      max: 52,
      label: "52 kg",
      squat: null,
      bench: { kg: 113.5, holder: "Selma Ramberg" },
      deadlift: { kg: 200.5, holder: "Farhanna Farid" },
    },
    {
      max: 57,
      label: "57 kg",
      squat: null,
      bench: { kg: 123, holder: "Donna Berglund" },
      deadlift: { kg: 230, holder: "Joy Nnamani" },
    },
    {
      max: 63,
      label: "63 kg",
      squat: null,
      bench: { kg: 143.5, holder: "Carola Garra" },
      deadlift: { kg: 231, holder: "Prescillia Bavoil" },
    },
    {
      max: 69,
      label: "69 kg",
      squat: null,
      bench: { kg: 144, holder: "Jennifer Thompson" },
      deadlift: { kg: 240, holder: "Kimberly Walford" },
    },
    {
      max: 76,
      label: "76 kg",
      squat: null,
      bench: { kg: 145.5, holder: "Laura Mautalen" },
      deadlift: { kg: 261.5, holder: "Jessica Buettner" },
    },
    {
      max: 84,
      label: "84 kg",
      squat: { kg: 250.5, holder: "Amanda Lawrence" },
      bench: { kg: 147.5, holder: "Agata Sitko" },
      deadlift: { kg: 260.5, holder: "Amanda Lawrence" },
    },
    {
      max: Infinity,
      label: "84+ kg",
      squat: null,
      bench: { kg: 164.5, holder: "Mahailya Reeves" },
      deadlift: { kg: 257.5, holder: "Sarah Brenner" },
    },
  ],
};

export const LIFT_LABEL: Record<RecordLift, string> = {
  squat: "Squat",
  bench: "Bench press",
  deadlift: "Deadlift",
};
