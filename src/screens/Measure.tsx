/** Measure tab — body measurements over time (weight, body fat, girths). */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { Card, NumberField, Pill, PrimaryButton, SectionTitle, Txt } from "../components/ui";
import { useStore } from "../lib/store";

const KINDS: { kind: string; unit: (u: string) => string }[] = [
  { kind: "Body weight", unit: (u) => u },
  { kind: "Body fat", unit: () => "%" },
  { kind: "Chest", unit: () => "cm" },
  { kind: "Waist", unit: () => "cm" },
  { kind: "Arm", unit: () => "cm" },
  { kind: "Thigh", unit: () => "cm" },
];

export function Measure() {
  const { measurements, addMeasurement, deleteMeasurement, settings } = useStore();
  const [kind, setKind] = useState(KINDS[0]);
  const [value, setValue] = useState("");

  const unit = kind.unit(settings.unit);
  const sorted = [...measurements].sort((a, b) => b.at - a.at);

  const submit = () => {
    const v = Number(value);
    if (!v) return;
    addMeasurement(kind.kind, v, unit);
    setValue("");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">Measure</Txt>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Log a measurement</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {KINDS.map((k) => (
            <Pressable
              key={k.kind}
              onPress={() => setKind(k)}
              style={{
                backgroundColor: kind.kind === k.kind ? C.primary : C.page2,
                borderRadius: R.pill,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Txt size={12} weight="bold" color={kind.kind === k.kind ? "#fff" : C.inkSoft}>
                {k.kind}
              </Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <NumberField value={value} onChange={setValue} suffix={unit} width={140} />
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Save" onPress={submit} disabled={!Number(value)} />
          </View>
        </View>
      </Card>

      <SectionTitle>Log</SectionTitle>
      {sorted.length === 0 ? (
        <Card>
          <Txt size={13} color={C.inkFaint}>No measurements yet.</Txt>
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {sorted.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: "rgba(20,26,24,0.06)" }} /> : null}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Txt weight="semibold">{m.kind}</Txt>
                  <Txt size={11} color={C.inkFaint}>
                    {new Date(m.at).toLocaleDateString()}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pill text={`${m.value} ${m.unit}`} color={C.goodAcc} bg={C.goodSurf} />
                  <Pressable hitSlop={8} onPress={() => deleteMeasurement(m.id)}>
                    <Icon name="Trash2" size={15} color={C.inkFaint} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
