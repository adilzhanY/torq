/**
 * Exercises tab — the same sectioned browser as the live-session "Add
 * exercises" picker (search / filter / order / new toolbar, library merged
 * with the full ExerciseDB catalog). Tapping a row opens the tabbed
 * exercise info page (About / History / Records).
 */
import { useState } from "react";
import { View } from "react-native";
import { ExerciseBrowser, type BrowserItem } from "../components/ExerciseBrowser";
import { ExerciseInfo } from "../components/ExerciseInfo";

export function Exercises() {
  const [detail, setDetail] = useState<BrowserItem | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ExerciseBrowser title="Exercises" onPressItem={setDetail} />
      {detail ? <ExerciseInfo exercise={detail} onClose={() => setDetail(null)} /> : null}
    </View>
  );
}
