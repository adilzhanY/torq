/**
 * Exercises tab — search across BOTH the personal library and the bundled
 * ExerciseDB catalog (with animated gif demos). Catalog entries expand to
 * show the demo + instructions and can be imported into the library.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { Card, Divider, Pill, PrimaryButton, SectionTitle, TextField, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import {
  DB_EXERCISES,
  DB_GIF_BY_ID,
  titleCase,
  toBodyPart,
  toEquipment,
  type DbExercise,
} from "../lib/exercisedb";

/** How many catalog matches to render at once (there are 1500+). */
const DB_PAGE = 30;
import type { BodyPart, Equipment } from "../types";

const BODY_PARTS: BodyPart[] = ["chest", "back", "legs", "shoulders", "arms", "core", "other"];
const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"];

function tokenize(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every query word must appear somewhere in the haystack, in any order —
 * so "bicep curl" finds "Cable Biceps Curl". */
function matches(q: string, hay: string[]): boolean {
  const tokens = tokenize(q);
  if (!tokens.length) return true;
  const text = hay.join(" ").toLowerCase();
  return tokens.every((t) => text.includes(t));
}

function DbExerciseCard({ ex }: { ex: DbExercise }) {
  const { exercises, addExercise } = useStore();
  const [open, setOpen] = useState(false);
  const added = exercises.some((e) => e.dbId === ex.id);

  const importIt = () => {
    if (added) return;
    addExercise({
      name: titleCase(ex.name),
      bodyPart: toBodyPart(ex.bodyParts[0] ?? "other"),
      equipment: toEquipment(ex.equipments[0] ?? "other"),
      dbId: ex.id,
    });
  };

  return (
    <Card style={{ gap: 10, padding: 12 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Image
          source={{ uri: ex.gifUrl }}
          style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: "#fff" }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt weight="semibold" numberOfLines={2}>{titleCase(ex.name)}</Txt>
          <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
            <Pill text={ex.bodyParts[0] ?? ""} color={C.inkSoft} bg={C.page2} />
            <Pill text={ex.equipments[0] ?? ""} color={C.inkSoft} bg={C.page2} />
          </View>
        </View>
        <Icon name={open ? "ChevronDown" : "ChevronRight"} size={18} color={C.inkFaint} />
      </Pressable>

      {open ? (
        <View style={{ gap: 10 }}>
          <Divider />
          <Image
            source={{ uri: ex.gifUrl }}
            style={{ width: "100%", aspectRatio: 1, borderRadius: R.sm, backgroundColor: "#fff" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <Txt size={12} weight="bold" color={C.inkSoft}>
            Targets {ex.targetMuscles.join(", ")}
            {ex.secondaryMuscles.length ? ` · also ${ex.secondaryMuscles.join(", ")}` : ""}
          </Txt>
          <View style={{ gap: 6 }}>
            {ex.instructions.map((step, i) => (
              <Txt key={i} size={13} color={C.inkSoft}>
                {step.replace(/^Step:\d+\s*/, `${i + 1}. `)}
              </Txt>
            ))}
          </View>
          <PrimaryButton
            label={added ? "In your library ✓" : "Add to my exercises"}
            onPress={importIt}
            disabled={added}
            background={added ? C.page2 : C.accent}
            color={added ? C.inkSoft : C.accentInk}
          />
        </View>
      ) : null}
    </Card>
  );
}

export function Exercises() {
  const { exercises, addExercise, deleteExercise } = useStore();
  const [q, setQ] = useState("");
  const [dbLimit, setDbLimit] = useState(DB_PAGE);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");

  const mine = exercises
    .filter((e) => matches(q, [e.name, e.bodyPart, e.equipment]))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Name hits rank above rows matched only via muscles/equipment.
  const qTokens = tokenize(q);
  const fromDb = DB_EXERCISES.filter((e) =>
    matches(q, [e.name, ...e.bodyParts, ...e.equipments, ...e.targetMuscles]),
  ).sort((a, b) => {
    if (!qTokens.length) return 0;
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    const aName = qTokens.every((t) => an.includes(t)) ? 0 : 1;
    const bName = qTokens.every((t) => bn.includes(t)) ? 0 : 1;
    return aName - bName || an.localeCompare(bn);
  });

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

      <TextField
        value={q}
        onChange={(v) => {
          setQ(v);
          setDbLimit(DB_PAGE);
        }}
        placeholder="Search exercises, muscles, equipment…"
      />

      <SectionTitle>My exercises · {mine.length}</SectionTitle>
      {mine.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>Nothing matches in your library.</Txt>
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {mine.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: "rgba(20,26,24,0.06)" }} /> : null}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                  gap: 10,
                }}
              >
                {e.dbId && DB_GIF_BY_ID[e.dbId] ? (
                  <Image
                    source={{ uri: DB_GIF_BY_ID[e.dbId] }}
                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#fff" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : null}
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
      )}

      <SectionTitle>Exercise database · {fromDb.length}</SectionTitle>
      {fromDb.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>No catalog exercises match “{q.trim()}”.</Txt>
        </Card>
      ) : (
        <>
          {fromDb.slice(0, dbLimit).map((e) => (
            <DbExerciseCard key={e.id} ex={e} />
          ))}
          {fromDb.length > dbLimit ? (
            <PrimaryButton
              label={`Show more (${fromDb.length - dbLimit} left)`}
              background={C.surface}
              color={C.primary}
              onPress={() => setDbLimit((n) => n + DB_PAGE)}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
