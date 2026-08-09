/**
 * Exercises — the same sectioned browser as the live-session "Add
 * exercises" picker (search / filter / order / new toolbar, library merged
 * with the full ExerciseDB catalog). Tapping a row opens the tabbed
 * exercise info page (About / History / Records / Charts / Rank).
 *
 * No longer a dock tab (2026-08-09, "Five, spelled out"): it is a sub-page
 * of Workout, reached from that tab's library row — so it carries a back
 * arrow, and Android's back button walks the same way.
 */
import { useState } from "react";
import { View } from "react-native";
import { ExerciseBrowser, type BrowserItem } from "../components/ExerciseBrowser";
import { ExerciseInfo } from "../components/ExerciseInfo";
import { useUi } from "../lib/ui";

export function Exercises() {
  const [detail, setDetail] = useState<BrowserItem | null>(null);
  const { setTab } = useUi();

  return (
    <View style={{ flex: 1 }}>
      <ExerciseBrowser
        title="Exercises"
        onPressItem={setDetail}
        onBack={() => setTab("workout")}
      />
      {detail ? <ExerciseInfo exercise={detail} onClose={() => setDetail(null)} /> : null}
    </View>
  );
}
