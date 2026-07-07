/**
 * Live-session "Add exercises" picker: the shared ExerciseBrowser in
 * multi-select mode, as a full-screen inline overlay. Tapping rows toggles
 * selection; a lime CTA adds every pick to the session (catalog picks are
 * imported into the library first). Creating a new exercise auto-selects it.
 */
import { useState } from "react";
import { C } from "../theme";
import { SlideUp } from "./anim";
import { PrimaryButton } from "./ui";
import { ExerciseBrowser, type BrowserItem } from "./ExerciseBrowser";
import { useStore } from "../lib/store";

export function ExercisePicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Library exercise ids to append to the session, in selection order. */
  onAdd: (exerciseIds: string[]) => void;
}) {
  const { addExercise } = useStore();
  // Keyed by BrowserItem.key; unmounting on close resets everything.
  const [selected, setSelected] = useState<Map<string, BrowserItem>>(new Map());

  if (!open) return null;

  const toggle = (item: BrowserItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.key)) next.delete(item.key);
      else next.set(item.key, item);
      return next;
    });

  const close = () => {
    setSelected(new Map());
    onClose();
  };

  /** Import any catalog picks into the library, then hand back library ids. */
  const confirm = () => {
    const ids: string[] = [];
    for (const item of selected.values()) {
      if (item.libId) {
        ids.push(item.libId);
      } else {
        ids.push(
          addExercise({
            name: item.name,
            bodyPart: item.bodyPart,
            equipment: item.equipment,
            dbId: item.dbId,
          }).id,
        );
      }
    }
    if (ids.length) onAdd(ids);
    close();
  };

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
      <ExerciseBrowser
        title="Add exercises"
        onBack={close}
        selected={new Set(selected.keys())}
        onPressItem={toggle}
        onCreated={(row) =>
          setSelected((prev) =>
            new Map(prev).set(row.id, {
              key: row.id,
              libId: row.id,
              name: row.name,
              bodyPart: row.bodyPart,
              equipment: row.equipment,
              hay: [],
              count: 0,
              lastAt: 0,
            }),
          )
        }
        footer={
          selected.size > 0 ? (
            <PrimaryButton
              label={`Add ${selected.size} exercise${selected.size > 1 ? "s" : ""}`}
              background={C.accent}
              color={C.accentInk}
              onPress={confirm}
            />
          ) : null
        }
      />
    </SlideUp>
  );
}
