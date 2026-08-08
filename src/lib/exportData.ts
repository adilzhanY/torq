/**
 * Data export.
 *
 * Deleting an account should never be the only way out of an app. This
 * writes the whole local database to a JSON file and hands it to the system
 * share sheet, so a user can keep their training history whatever they
 * decide about the account — and so "delete everything" is a choice rather
 * than a threat.
 *
 * The format is the raw DB shape plus a version stamp: readable, and the
 * same thing an import path would consume when one exists.
 */
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { DB } from "./db";

export interface ExportResult {
  ok: boolean;
  error: string | null;
}

/** Stable, sortable, filename-safe: torq-export-2026-08-08.json */
function filename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `torq-export-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export function exportPayload(db: DB, now: Date): string {
  return JSON.stringify(
    {
      format: "torq.export.v1",
      exportedAt: now.toISOString(),
      counts: {
        exercises: db.exercises.length,
        routines: db.routines.length,
        workouts: db.workouts.length,
        measurements: db.measurements.length,
      },
      data: db,
    },
    null,
    2,
  );
}

/**
 * Write the DB to a file and open the share sheet.
 *
 * Uses the SDK 57 File/Paths API — `FileSystem.cacheDirectory` and
 * `writeAsStringAsync` moved to `expo-file-system/legacy` in this version.
 */
export async function exportData(db: DB, now = new Date()): Promise<ExportResult> {
  try {
    const file = new File(Paths.cache, filename(now));
    // Exporting twice in one day must overwrite, not throw.
    if (file.exists) file.delete();
    file.create();
    file.write(exportPayload(db, now));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: `Saved to ${file.uri}, but sharing isn't available here.` };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Export torq data",
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export failed." };
  }
}
