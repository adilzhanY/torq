/**
 * The shared exercise browser: the user's library merged with the full
 * ExerciseDB catalog in one sectioned list, with a Search / Filter / Order /
 * New toolbar. Used by the live-session "Add exercises" picker (multi-select)
 * and the Exercises tab (tap opens the exercise detail) so both look the same.
 *
 * Overlays (order menu, filter dialog, new-exercise sheet) are inline views,
 * not Modals — Modals clip bottom-anchored content on this emulator.
 */
import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, SectionList, View } from "react-native";
import { Image } from "expo-image";
import { C, R, clay, claySm } from "../theme";
import { Icon } from "./Icon";
import { PopIn, SlideUp, Squish } from "./anim";
import { CenterDialog } from "./Dialog";
import { Divider, SectionTitle, TextField, Txt } from "./ui";
import { useStore } from "../lib/store";
import { matches } from "../lib/search";
import {
  DB_EXERCISES,
  DB_GIF_BY_ID,
  titleCase,
  toBodyPart,
  toEquipment,
} from "../lib/exercisedb";
import type { BodyPart, Equipment, Exercise } from "../types";

const BODY_PARTS: BodyPart[] = [
  "arms", "back", "cardio", "chest", "core", "legs", "olympic", "shoulders", "other",
];
const EQUIPMENT: Equipment[] = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other",
];

type Sort = "name" | "frequency" | "last";
const SORTS: { key: Sort; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "frequency", label: "Frequency" },
  { key: "last", label: "Last performed" },
];

/** One row: a library exercise or a not-yet-imported catalog one. */
export interface BrowserItem {
  key: string;
  libId?: string;
  dbId?: string;
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  gifUrl?: string;
  hay: string[];
  /** Sessions this exercise appears in / most recent one (library only). */
  count: number;
  lastAt: number;
}

const DAY = 24 * 60 * 60 * 1000;

function freqBucket(count: number): string {
  if (count >= 26) return "26+ times";
  if (count >= 11) return "11–25 times";
  if (count >= 6) return "6–10 times";
  if (count >= 1) return "1–5 times";
  return "Not performed";
}
const FREQ_ORDER = ["26+ times", "11–25 times", "6–10 times", "1–5 times", "Not performed"];

function lastBucket(at: number, now: number): string {
  if (!at) return "Never";
  if (now - at < 7 * DAY) return "This week";
  if (now - at < 30 * DAY) return "This month";
  if (now - at < 90 * DAY) return "Last 3 months";
  return "Earlier";
}
const LAST_ORDER = ["This week", "This month", "Last 3 months", "Earlier", "Never"];

/** Selectable filter chip (lime when active, like the done-set tint). */
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? C.accent : C.page2,
        borderRadius: R.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Txt size={12} weight="bold" color={active ? C.accentInk : C.inkSoft}>
        {label}
      </Txt>
    </Pressable>
  );
}

const Row = React.memo(function Row({
  item,
  selected,
  onPress,
}: {
  item: BrowserItem;
  selected: boolean;
  onPress: (item: BrowserItem) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 7,
        backgroundColor: selected ? "rgba(160,210,20,0.42)" : "transparent",
      }}
    >
      {item.gifUrl ? (
        <Image
          source={{ uri: item.gifUrl }}
          style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: "#fff" }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            backgroundColor: C.page2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Dumbbell" size={22} color={C.inkSoft} />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt weight="semibold" numberOfLines={1}>{item.name}</Txt>
        <Txt size={11} color={C.inkFaint}>
          {item.bodyPart} · {item.equipment}
        </Txt>
      </View>
      {selected ? (
        <Icon name="Check" size={18} color={C.inkSoft} />
      ) : item.count > 0 ? (
        <Txt size={14} weight="bold" color={C.inkSoft}>{item.count}</Txt>
      ) : null}
    </Pressable>
  );
});

export function ExerciseBrowser({
  title,
  onBack,
  selected,
  onPressItem,
  onCreated,
  footer,
}: {
  title: string;
  /** Renders a back chevron; hardware Back also lands here (after peeling overlays). */
  onBack?: () => void;
  /** Keys of multi-selected rows (picker mode); rows tint lime + check. */
  selected?: Set<string>;
  onPressItem: (item: BrowserItem) => void;
  /** Fired after the New-exercise sheet saves a row to the library. */
  onCreated?: (ex: Exercise) => void;
  /** Pinned above the BottomNav, under this browser's own overlays
   * (the picker's "Add N exercises" CTA). */
  footer?: React.ReactNode;
}) {
  const { exercises, workouts, addExercise } = useStore();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [orderOpen, setOrderOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bodyF, setBodyF] = useState<Set<BodyPart>>(new Set());
  const [equipF, setEquipF] = useState<Set<Equipment>>(new Set());
  // New-exercise sheet state.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState<BodyPart>("chest");
  const [newEquip, setNewEquip] = useState<Equipment>("barbell");

  // Android back: peel overlays first, then defer to onBack (if any).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (creating) setCreating(false);
      else if (filterOpen) setFilterOpen(false);
      else if (orderOpen) setOrderOpen(false);
      else if (onBack) onBack();
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [creating, filterOpen, orderOpen, onBack]);

  const items = useMemo<BrowserItem[]>(() => {
    const stats = new Map<string, { n: number; last: number }>();
    for (const w of workouts) {
      for (const e of w.entries) {
        const s = stats.get(e.exerciseId) ?? { n: 0, last: 0 };
        s.n += 1;
        s.last = Math.max(s.last, w.startedAt);
        stats.set(e.exerciseId, s);
      }
    }
    const imported = new Set(exercises.map((e) => e.dbId).filter(Boolean));
    const out: BrowserItem[] = exercises.map((e) => ({
      key: e.id,
      libId: e.id,
      dbId: e.dbId,
      name: e.name,
      bodyPart: e.bodyPart,
      equipment: e.equipment,
      gifUrl: e.dbId ? DB_GIF_BY_ID[e.dbId] : undefined,
      hay: [e.name, e.bodyPart, e.equipment],
      count: stats.get(e.id)?.n ?? 0,
      lastAt: stats.get(e.id)?.last ?? 0,
    }));
    for (const d of DB_EXERCISES) {
      if (imported.has(d.id)) continue;
      out.push({
        key: `db:${d.id}`,
        dbId: d.id,
        name: titleCase(d.name),
        bodyPart: toBodyPart(d.bodyParts[0] ?? "other"),
        equipment: toEquipment(d.equipments[0] ?? "other"),
        gifUrl: d.gifUrl,
        hay: [d.name, ...d.bodyParts, ...d.equipments, ...d.targetMuscles],
        count: 0,
        lastAt: 0,
      });
    }
    return out;
  }, [exercises, workouts]);

  /** Chip filters only — its length is the live count in the Filter title. */
  const chipFiltered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!bodyF.size || bodyF.has(i.bodyPart)) &&
          (!equipF.size || equipF.has(i.equipment)),
      ),
    [items, bodyF, equipF],
  );

  const sections = useMemo(() => {
    const visible = chipFiltered.filter((i) => matches(q, i.hay));
    const groups = new Map<string, BrowserItem[]>();
    const now = Date.now();
    for (const i of visible) {
      const sectionTitle =
        sort === "name"
          ? /^[a-z]/i.test(i.name)
            ? i.name[0].toUpperCase()
            : "#"
          : sort === "frequency"
            ? freqBucket(i.count)
            : lastBucket(i.lastAt, now);
      const g = groups.get(sectionTitle) ?? [];
      g.push(i);
      groups.set(sectionTitle, g);
    }
    const titles = [...groups.keys()].sort((a, b) => {
      if (sort === "name") return a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b);
      const order = sort === "frequency" ? FREQ_ORDER : LAST_ORDER;
      return order.indexOf(a) - order.indexOf(b);
    });
    return titles.map((sectionTitle) => ({
      title: sectionTitle,
      data: groups.get(sectionTitle)!.sort((a, b) =>
        sort === "frequency"
          ? b.count - a.count || a.name.localeCompare(b.name)
          : sort === "last"
            ? b.lastAt - a.lastAt || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
      ),
    }));
  }, [chipFiltered, q, sort]);

  const saveNew = () => {
    if (!newName.trim()) return;
    const row = addExercise({ name: newName.trim(), bodyPart: newBody, equipment: newEquip });
    setNewName("");
    setCreating(false);
    onCreated?.(row);
  };

  const filtersOn = bodyF.size > 0 || equipF.size > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Toolbar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 12,
          gap: 20,
        }}
      >
        {onBack ? (
          <Pressable hitSlop={8} onPress={onBack}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={() => setSearchOpen((v) => !v)}>
          <Icon name="Search" size={21} color={searchOpen || q ? C.ink : C.inkSoft} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => setFilterOpen(true)}>
          <View
            style={
              filtersOn
                ? { backgroundColor: C.accent, borderRadius: R.pill, padding: 5, margin: -5 }
                : undefined
            }
          >
            <Icon name="Filter" size={21} color={filtersOn ? C.accentInk : C.inkSoft} />
          </View>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => setOrderOpen(true)}>
          <Icon name="ArrowUpDown" size={21} color={C.inkSoft} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => setCreating(true)}>
          <Icon name="Plus" size={24} color={C.ink} />
        </Pressable>
      </View>

      <Txt size={22} weight="extrabold" style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {title}
      </Txt>

      {searchOpen || q ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <TextField
            value={q}
            onChange={setQ}
            placeholder="Search exercises, muscles, equipment…"
            autoFocus
          />
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => (
          <Row item={item} selected={selected?.has(item.key) ?? false} onPress={onPressItem} />
        )}
        renderSectionHeader={({ section }) => (
          <Txt
            size={sort === "name" ? 18 : 13}
            weight="extrabold"
            color={sort === "name" ? C.ink : C.inkSoft}
            style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}
          >
            {section.title}
          </Txt>
        )}
        ListEmptyComponent={
          <Txt size={13} color={C.inkFaint} style={{ padding: 16 }}>
            No exercises match.
          </Txt>
        }
        contentContainerStyle={{ paddingBottom: 170 }}
        stickySectionHeadersEnabled={false}
        initialNumToRender={16}
        maxToRenderPerBatch={24}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />

      {footer ? (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 100 }}>{footer}</View>
      ) : null}

      {/* Order menu — anchored under the toolbar's sort icon */}
      {orderOpen ? (
        <Pressable
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          onPress={() => setOrderOpen(false)}
        >
          <PopIn style={{ position: "absolute", top: 42, right: 16, width: 210 }}>
            <View style={[{ backgroundColor: C.surface, borderRadius: R.md, padding: 4 }, clay()]}>
              {SORTS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    setSort(s.key);
                    setOrderOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                >
                  <Txt size={13} weight="semibold" style={{ flex: 1 }}>
                    {s.label}
                  </Txt>
                  {sort === s.key ? <Icon name="Check" size={15} color={C.inkSoft} /> : null}
                </Pressable>
              ))}
            </View>
          </PopIn>
        </Pressable>
      ) : null}

      {/* Filter dialog */}
      {filterOpen ? (
        <CenterDialog onClose={() => setFilterOpen(false)}>
                <Txt size={18} weight="extrabold">Filter ({chipFiltered.length})</Txt>
                <SectionTitle>Body part</SectionTitle>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {BODY_PARTS.map((b) => (
                    <Chip
                      key={b}
                      label={b}
                      active={bodyF.has(b)}
                      onPress={() =>
                        setBodyF((prev) => {
                          const next = new Set(prev);
                          next.has(b) ? next.delete(b) : next.add(b);
                          return next;
                        })
                      }
                    />
                  ))}
                </View>
                <SectionTitle>Category</SectionTitle>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {EQUIPMENT.map((e) => (
                    <Chip
                      key={e}
                      label={e}
                      active={equipF.has(e)}
                      onPress={() =>
                        setEquipF((prev) => {
                          const next = new Set(prev);
                          next.has(e) ? next.delete(e) : next.add(e);
                          return next;
                        })
                      }
                    />
                  ))}
                </View>
                <Divider />
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16 }}>
                  {filtersOn ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setBodyF(new Set());
                        setEquipF(new Set());
                      }}
                    >
                      <Txt size={14} weight="bold" color={C.inkFaint}>Clear</Txt>
                    </Pressable>
                  ) : null}
                  <Pressable hitSlop={8} onPress={() => setFilterOpen(false)}>
                    <Txt size={14} weight="extrabold" color={C.goodAcc}>OK</Txt>
                  </Pressable>
                </View>
        </CenterDialog>
      ) : null}

      {/* New-exercise bottom sheet */}
      {creating ? (
        <>
          <Pressable
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "rgba(20,26,24,0.4)",
            }}
            onPress={() => setCreating(false)}
          />
          <SlideUp style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
            <View
              style={[
                {
                  backgroundColor: C.surface,
                  borderTopLeftRadius: R.lg,
                  borderTopRightRadius: R.lg,
                  padding: 16,
                  paddingBottom: 96,
                  gap: 12,
                },
                clay(),
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Txt size={17} weight="extrabold">New exercise</Txt>
                <Pressable hitSlop={8} onPress={() => setCreating(false)}>
                  <Icon name="X" size={20} color={C.inkSoft} />
                </Pressable>
              </View>
              <TextField
                value={newName}
                onChange={setNewName}
                placeholder="Exercise name"
                onSubmit={saveNew}
                autoFocus
              />
              <SectionTitle>Body part</SectionTitle>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {BODY_PARTS.map((b) => (
                  <Chip key={b} label={b} active={newBody === b} onPress={() => setNewBody(b)} />
                ))}
              </View>
              <SectionTitle>Category</SectionTitle>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {EQUIPMENT.map((e) => (
                  <Chip key={e} label={e} active={newEquip === e} onPress={() => setNewEquip(e)} />
                ))}
              </View>
              <Squish
                onPress={saveNew}
                disabled={!newName.trim()}
                style={[
                  {
                    backgroundColor: C.accent,
                    borderRadius: R.sm,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: newName.trim() ? 1 : 0.4,
                  },
                  claySm(),
                ]}
              >
                <Txt weight="bold" color={C.accentInk}>Save exercise</Txt>
              </Squish>
            </View>
          </SlideUp>
        </>
      ) : null}
    </View>
  );
}
