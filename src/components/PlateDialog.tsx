/**
 * What to load, for every weight in one exercise.
 *
 * Opened from the live session's exercise menu. It answers the question a
 * lifter actually has at the rack ("what goes on for my top set, and for the
 * warm-ups") rather than making them do the arithmetic between sets.
 *
 * Every DISTINCT weight in the exercise gets a row, warm-ups included and
 * marked, because the ramp is exactly when the maths is most annoying.
 * Weights a bar cannot make (dumbbells, machines, anything under the empty
 * bar) say so instead of inventing a loadout.
 */
import { View } from "react-native";
import { C, R } from "../theme";
import { CustomModal } from "./CustomModal";
import { Txt } from "./ui";
import { BAR, PLATES, loadout, loadoutText } from "../lib/plates";
import type { Unit, WorkoutSet } from "../types";

export function PlateDialog({
  title,
  sets,
  unit,
  barWeight,
  plates,
  onClose,
}: {
  title: string;
  sets: WorkoutSet[];
  unit: Unit;
  /** Overridable so a gym with a different bar stays honest. */
  barWeight?: number;
  plates?: number[];
  onClose: () => void;
}) {
  const bar = barWeight ?? BAR[unit];
  const set = plates ?? PLATES[unit];

  // Distinct weights, heaviest first: the top set is what you came for.
  const seen = new Set<number>();
  const rows = sets
    .filter((s) => s.weight > 0 && !seen.has(s.weight) && (seen.add(s.weight), true))
    .sort((a, b) => b.weight - a.weight);

  return (
    <CustomModal onClose={onClose}>
      <Txt size={18} weight="extrabold">Plate math</Txt>
      <Txt size={12.5} color={C.inkSoft} style={{ marginTop: -6 }}>
        {title} · {bar} {unit} bar · per side
      </Txt>

      {rows.length === 0 ? (
        <Txt size={13} color={C.inkFaint}>Nothing loaded yet.</Txt>
      ) : (
        <View style={{ gap: 2 }}>
          {rows.map((s) => {
            const l = loadout(s.weight, bar, set);
            const warm = s.type === "warmup";
            return (
              <View
                key={s.weight}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 7,
                  borderTopWidth: 1,
                  borderTopColor: C.hair,
                }}
              >
                <Txt
                  size={14}
                  weight="extrabold"
                  color={warm ? C.warnAcc : C.ink}
                  style={{ width: 64 }}
                >
                  {s.weight} {unit}
                </Txt>
                {l ? (
                  <>
                    <Txt size={13} weight="bold" color={C.accent} style={{ flex: 1 }}>
                      {loadoutText(l)}
                    </Txt>
                    {!l.exact ? (
                      <Txt size={11} color={C.warnAcc}>
                        loads {l.total}
                      </Txt>
                    ) : null}
                  </>
                ) : (
                  <Txt size={12.5} color={C.inkFaint} style={{ flex: 1 }}>
                    not a barbell weight
                  </Txt>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View
        style={{
          backgroundColor: C.page2,
          borderRadius: R.sm,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <Txt size={11} color={C.inkFaint}>
          Assuming a {bar} {unit} bar and plates of {set.join(" · ")} {unit}.
        </Txt>
      </View>
    </CustomModal>
  );
}
