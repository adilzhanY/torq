/**
 * "Add warm-up sets" — Strong's dialog (Adilzhan's request, 2026-08-09).
 *
 * It used to insert a 40/60/80% ramp silently the moment you tapped the menu
 * item, which is the wrong shape for this decision twice over: warming up for
 * a heavy triple and warming up for lateral raises are not the same ramp, and
 * a menu item that changes your set list with no preview is a thing you undo
 * rather than a thing you use.
 *
 * So: edit the formula, see the real kilos as you type, then insert. The ramp
 * is remembered ON THE EXERCISE, so tuning it for squats does not follow you
 * to curls — that is the answer to "different percentages for different
 * exercises". The app does not guess a per-exercise default (nothing in the
 * catalog would justify one); it learns yours.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { CustomModal, useModalClose } from "./CustomModal";
import { Icon } from "./Icon";
import { NumberField, Txt } from "./ui";
import { BAR_WEIGHT, DEFAULT_WARMUP, warmupWeight } from "../lib/warmup";
import type { Equipment, Unit, WarmupRow } from "../types";

/** A row's two editable numbers, kept as strings while being typed. */
function Row({
  row,
  workWeight,
  unit,
  equipment,
  onChange,
  onRemove,
}: {
  row: WarmupRow;
  workWeight: number;
  unit: Unit;
  equipment?: Equipment;
  onChange: (next: WarmupRow) => void;
  onRemove: () => void;
}) {
  const kg = warmupWeight(row, workWeight, unit, equipment);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}>
      <Txt size={13} weight="extrabold" color={C.warnAcc} style={{ width: 22 }}>W</Txt>

      {row.bar ? (
        <View
          style={{
            width: 52,
            paddingVertical: 6,
            alignItems: "center",
            backgroundColor: C.page2,
            borderRadius: R.sm,
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <Txt size={13} weight="bold">Bar</Txt>
        </View>
      ) : (
        <NumberField
          value={row.pct ? String(row.pct) : ""}
          onChange={(v) => onChange({ ...row, pct: Number(v) || 0 })}
          width={52}
          suffix="%"
          compact
          center
          selectTextOnFocus
        />
      )}
      <Txt size={12} color={C.inkFaint}>×</Txt>
      <NumberField
        value={row.reps ? String(row.reps) : ""}
        onChange={(v) => onChange({ ...row, reps: Number(v) || 0 })}
        width={46}
        compact
        center
        selectTextOnFocus
      />

      <Txt size={13} weight="bold" color={C.inkSoft} style={{ flex: 1, textAlign: "right" }}>
        {kg} {unit} × {row.reps || 0}
      </Txt>
      <Pressable hitSlop={8} onPress={onRemove}>
        <Icon name="X" size={14} color={C.inkFaint} />
      </Pressable>
    </View>
  );
}

/**
 * Footer as its OWN component, because `useModalClose()` reads a context
 * that CustomModal provides — calling it in the component that RENDERS the
 * dialog lands outside the provider and silently returns the no-op fallback.
 * (Which is exactly the bug this shipped with for one build: Insert inserted
 * and the dialog stayed open.) ConfirmButtons in Dialog.tsx exists for the
 * same reason.
 */
function Footer({ onRestore, onInsert }: { onRestore: () => void; onInsert: () => void }) {
  const close = useModalClose();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
      }}
    >
      <Pressable hitSlop={8} onPress={onRestore}>
        <Txt size={13} weight="bold" color={C.inkSoft}>Restore</Txt>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Pressable hitSlop={8} onPress={close}>
          <Txt size={13} weight="bold" color={C.inkSoft}>Cancel</Txt>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => {
            onInsert();
            close();
          }}
        >
          <Txt size={13} weight="extrabold" color={C.accent}>Insert</Txt>
        </Pressable>
      </View>
    </View>
  );
}

export function WarmupDialog({
  /** Heaviest working set, prefilled into the work-set field. */
  workWeight,
  unit,
  equipment,
  /** The exercise's saved ramp, or the default when it has none yet. */
  rows: saved,
  onInsert,
  onClose,
}: {
  workWeight: number;
  unit: Unit;
  equipment?: Equipment;
  rows?: WarmupRow[];
  onInsert: (rows: WarmupRow[], workWeight: number) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<WarmupRow[]>(saved?.length ? saved : DEFAULT_WARMUP);
  const [work, setWork] = useState(workWeight > 0 ? String(workWeight) : "");
  const workNum = Number(work) || 0;

  const patch = (i: number, next: WarmupRow) =>
    setRows(rows.map((r, k) => (k === i ? next : r)));

  return (
    <CustomModal onClose={onClose}>
      <Txt size={18} weight="extrabold">Add warm-up sets</Txt>

      <NumberField
        label={`Work set (${unit})`}
        value={work}
        onChange={setWork}
        placeholder={String(BAR_WEIGHT[unit])}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Txt
          size={10}
          weight="bold"
          color={C.inkFaint}
          numberOfLines={1}
          style={{ width: 22, letterSpacing: 1 }}
        >
          SET
        </Txt>
        <Txt size={10} weight="bold" color={C.inkFaint} style={{ letterSpacing: 1 }}>
          FORMULA
        </Txt>
        <Txt
          size={10}
          weight="bold"
          color={C.inkFaint}
          style={{ flex: 1, textAlign: "right", letterSpacing: 1 }}
        >
          WARM-UP
        </Txt>
        <View style={{ width: 14 }} />
      </View>

      {/* Scrolls because "Add set" has no ceiling and the dialog does. */}
      <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
        {rows.map((row, i) => (
          <Row
            key={i}
            row={row}
            workWeight={workNum}
            unit={unit}
            equipment={equipment}
            onChange={(next) => patch(i, next)}
            onRemove={() => setRows(rows.filter((_, k) => k !== i))}
          />
        ))}
      </ScrollView>

      <Pressable
        onPress={() => setRows([...rows, { pct: 60, reps: 3 }])}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }}
      >
        <Icon name="Plus" size={15} color={C.accent} />
        <Txt size={13} weight="bold" color={C.accent}>Add set</Txt>
      </Pressable>

      <Footer
        onRestore={() => setRows(DEFAULT_WARMUP)}
        onInsert={() => onInsert(rows, workNum)}
      />
    </CustomModal>
  );
}
