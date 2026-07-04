/** Exercises tab — the movement library: search, add, delete. */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { Card, PrimaryButton, SectionTitle, TextField, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import type { BodyPart, Equipment } from "../types";

const BODY_PARTS: BodyPart[] = ["chest", "back", "legs", "shoulders", "arms", "core", "other"];
const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"];

export function Exercises() {
  const { exercises, addExercise, deleteExercise } = useStore();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");

  const list = exercises
    .filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const submit = () => {
    if (!name.trim()) return;
    addExercise({ name: name.trim(), bodyPart, equipment });
    setName("");
    setAdding(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Txt size={22} weight="extrabold">Exercises</Txt>
        <Pressable
          hitSlop={8}
          onPress={() => setAdding((v) => !v)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: adding ? C.page2 : C.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={adding ? "X" : "Plus"} size={18} color={adding ? C.inkSoft : "#fff"} />
        </Pressable>
      </View>

      {adding ? (
        <Card style={{ gap: 10 }}>
          <SectionTitle>New exercise</SectionTitle>
          <TextField value={name} onChange={setName} placeholder="Exercise name" onSubmit={submit} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {BODY_PARTS.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBodyPart(b)}
                style={{
                  backgroundColor: bodyPart === b ? C.primary : C.page2,
                  borderRadius: R.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}
              >
                <Txt size={12} weight="bold" color={bodyPart === b ? "#fff" : C.inkSoft}>
                  {b}
                </Txt>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {EQUIPMENT.map((eq) => (
              <Pressable
                key={eq}
                onPress={() => setEquipment(eq)}
                style={{
                  backgroundColor: equipment === eq ? C.primary : C.page2,
                  borderRadius: R.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}
              >
                <Txt size={12} weight="bold" color={equipment === eq ? "#fff" : C.inkSoft}>
                  {eq}
                </Txt>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Add exercise" onPress={submit} disabled={!name.trim()} />
        </Card>
      ) : null}

      <TextField value={q} onChange={setQ} placeholder="Search…" />
      <SectionTitle>{list.length} exercises</SectionTitle>

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {list.map((e, i) => (
          <View key={e.id}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: "rgba(20,26,24,0.06)" }} /> : null}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 10,
              }}
            >
              <View style={{ gap: 2, flex: 1 }}>
                <Txt weight="semibold">{e.name}</Txt>
                <Txt size={11} color={C.inkFaint}>
                  {e.bodyPart} · {e.equipment}
                </Txt>
              </View>
              <Pressable hitSlop={8} onPress={() => deleteExercise(e.id)}>
                <Icon name="Trash2" size={15} color={C.inkFaint} />
              </Pressable>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
