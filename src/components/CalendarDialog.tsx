/**
 * Custom calendar in the app's CenterDialog: ‹ Month Year › header stepping
 * months; tapping the title flips to a month grid with a ‹ Year › stepper
 * (jump to any month/year), then back to days. Mo–Su grid, adjacent-month
 * days faint, selected day is a black capsule, today is ringed, future days
 * disabled. Picking a day calls onPick(local-midnight ms) and closes.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { C } from "../theme";
import { Icon } from "./Icon";
import { CenterDialog } from "./Dialog";
import { Txt } from "./ui";
import { dayStart } from "./DateRuler";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** 42 cells (6 weeks) starting from the Monday on/before the 1st. */
function gridDays(year: number, month: number): number[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // days shown from the previous month
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime(),
  );
}

function Chevron({ dir, onPress, disabled }: { dir: "left" | "right"; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable hitSlop={10} onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.25 : 1 }}>
      <Icon name={dir === "left" ? "ChevronLeft" : "ChevronRight"} size={20} color={C.ink} />
    </Pressable>
  );
}

export function CalendarDialog({
  date,
  onPick,
  onClose,
}: {
  /** Selected day, local-midnight ms. */
  date: number;
  onPick: (dayMs: number) => void;
  onClose: () => void;
}) {
  const selected = dayStart(date);
  const today = dayStart(Date.now());
  const [year, setYear] = useState(new Date(selected).getFullYear());
  const [month, setMonth] = useState(new Date(selected).getMonth());
  const [pickingMonth, setPickingMonth] = useState(false);

  const step = (d: number) => {
    const m = month + d;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12);
  };
  // Whether stepping/selecting forward would land past the current month.
  const atCurrentMonth =
    year > new Date(today).getFullYear() ||
    (year === new Date(today).getFullYear() && month >= new Date(today).getMonth());

  return (
    <CenterDialog onClose={onClose}>
      {/* Header: month stepper, or year stepper while picking a month */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Chevron dir="left" onPress={() => (pickingMonth ? setYear(year - 1) : step(-1))} />
        <Pressable hitSlop={8} onPress={() => setPickingMonth(!pickingMonth)}>
          <Txt size={16} weight="extrabold">
            {pickingMonth ? String(year) : `${MONTHS[month]} ${year}`}
          </Txt>
        </Pressable>
        <Chevron
          dir="right"
          onPress={() => (pickingMonth ? setYear(year + 1) : step(1))}
          disabled={pickingMonth ? year >= new Date(today).getFullYear() : atCurrentMonth}
        />
      </View>

      {pickingMonth ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {MONTHS_SHORT.map((m, i) => {
            const future =
              year > new Date(today).getFullYear() ||
              (year === new Date(today).getFullYear() && i > new Date(today).getMonth());
            const active = i === month && year === new Date(selected).getFullYear();
            return (
              <Pressable
                key={m}
                disabled={future}
                onPress={() => {
                  setMonth(i);
                  setPickingMonth(false);
                }}
                style={{
                  width: "25%",
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: future ? 0.25 : 1,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: active ? C.primary : "transparent",
                  }}
                >
                  <Txt size={13} weight="bold" color={active ? "#fff" : C.ink}>{m}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row" }}>
            {WEEKDAYS.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                <Txt size={11} weight="bold" color={C.inkFaint}>{d}</Txt>
              </View>
            ))}
          </View>
          {Array.from({ length: 6 }, (_, row) => (
            <View key={row} style={{ flexDirection: "row" }}>
              {gridDays(year, month)
                .slice(row * 7, row * 7 + 7)
                .map((ms) => {
                  const d = new Date(ms);
                  const inMonth = d.getMonth() === month;
                  const future = ms > today;
                  const isSelected = ms === selected;
                  const isToday = ms === today;
                  return (
                    <Pressable
                      key={ms}
                      disabled={future}
                      onPress={() => {
                        onPick(ms);
                        onClose();
                      }}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 3 }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected ? C.primary : "transparent",
                          borderWidth: isToday && !isSelected ? 1.5 : 0,
                          borderColor: C.ink,
                          opacity: future ? 0.25 : 1,
                        }}
                      >
                        <Txt
                          size={13}
                          weight={isSelected || isToday ? "extrabold" : "semibold"}
                          color={isSelected ? "#fff" : inMonth ? C.ink : C.inkFaint}
                        >
                          {d.getDate()}
                        </Txt>
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          ))}
        </View>
      )}
    </CenterDialog>
  );
}
