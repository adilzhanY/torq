/**
 * Exercises tab — the same sectioned browser as the live-session "Add
 * exercises" picker (search / filter / order / new toolbar, library merged
 * with the full ExerciseDB catalog). Tapping a row opens the exercise
 * detail: demo gif, muscles, instructions, add-to-library or delete.
 */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { Pill, PrimaryButton, Txt } from "../components/ui";
import { SlideUp } from "../components/anim";
import { ExerciseBrowser, type BrowserItem } from "../components/ExerciseBrowser";
import { useStore } from "../lib/store";
import { DB_BY_ID } from "../lib/exercisedb";

function ExerciseDetail({ item, onClose }: { item: BrowserItem; onClose: () => void }) {
  const { exercises, addExercise, deleteExercise } = useStore();
  // Re-resolve against the store so importing flips the button state live.
  const libRow = exercises.find((e) =>
    item.libId ? e.id === item.libId : e.dbId != null && e.dbId === item.dbId,
  );
  const db = item.dbId ? DB_BY_ID[item.dbId] : undefined;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <SlideUp
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.page,
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <Txt size={20} weight="extrabold" style={{ flex: 1 }}>
            {libRow?.name ?? item.name}
          </Txt>
        </View>

        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill text={item.bodyPart} color={C.inkSoft} bg={C.surface} />
          <Pill text={item.equipment} color={C.inkSoft} bg={C.surface} />
          {libRow ? <Pill text="in your library" color={C.goodAcc} bg={C.goodSurf} /> : null}
        </View>

        {item.gifUrl ? (
          <Image
            source={{ uri: item.gifUrl }}
            style={{ width: "100%", aspectRatio: 1, borderRadius: R.md, backgroundColor: "#fff" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 160,
              borderRadius: R.md,
              backgroundColor: C.page2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Dumbbell" size={44} color={C.inkFaint} />
          </View>
        )}

        {db ? (
          <>
            <Txt size={12} weight="bold" color={C.inkSoft}>
              Targets {db.targetMuscles.join(", ")}
              {db.secondaryMuscles.length ? ` · also ${db.secondaryMuscles.join(", ")}` : ""}
            </Txt>
            <View style={{ gap: 6 }}>
              {db.instructions.map((step, i) => (
                <Txt key={i} size={13} color={C.inkSoft}>
                  {step.replace(/^Step:\d+\s*/, `${i + 1}. `)}
                </Txt>
              ))}
            </View>
          </>
        ) : null}

        {!libRow ? (
          <PrimaryButton
            label="Add to my exercises"
            background={C.accent}
            color={C.accentInk}
            onPress={() =>
              addExercise({
                name: item.name,
                bodyPart: item.bodyPart,
                equipment: item.equipment,
                dbId: item.dbId,
              })
            }
          />
        ) : (
          <PrimaryButton
            label="Delete from my exercises"
            background={C.badSurf}
            color={C.badAcc}
            onPress={() => {
              deleteExercise(libRow.id);
              onClose();
            }}
          />
        )}
      </ScrollView>
    </SlideUp>
  );
}

export function Exercises() {
  const [detail, setDetail] = useState<BrowserItem | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ExerciseBrowser title="Exercises" onPressItem={setDetail} />
      {detail ? <ExerciseDetail item={detail} onClose={() => setDetail(null)} /> : null}
    </View>
  );
}
