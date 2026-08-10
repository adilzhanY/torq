/**
 * One session on the timeline rail: History's row, extracted so Home's
 * "Recent workouts" is the same object rather than a second design of it
 * (Adilzhan, 2026-08-10: "recent workouts on the home page have an old
 * design, change it to what is shown now in History page").
 *
 * The row says what the session DID (records, points gained, muscles
 * worked) instead of listing its exercises, which is the whole argument
 * from the History redesign. The full inventory is one tap away in the
 * summary.
 *
 * Home passes no `onDelete` (a glance list should not offer to destroy
 * anything) and no `gapDays` (rest-day markers are History's way of showing
 * your pattern; on three teaser rows they would be noise).
 */
import { Pressable, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";
import { fmtDuration } from "../lib/stats";
import { workoutSets, type Workout } from "../types";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Distance from a row's top edge to the centre of its dot. */
export const DOT_MID = 25;

export function Chip({ text, tone }: { text: string; tone?: "gold" | "accent" }) {
  const [bg, fg] =
    tone === "gold"
      ? ["rgba(233,185,32,0.14)", C.gold]
      : tone === "accent"
        ? ["rgba(200,254,35,0.14)", C.accent]
        : [C.page2, C.inkSoft];
  return (
    <View style={{ backgroundColor: bg, borderRadius: R.sm, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Txt size={10.5} weight="bold" color={fg}>{text}</Txt>
    </View>
  );
}

/**
 * The rail segment every row draws for itself. `capTop`/`capBottom` stop it
 * at the dot instead of the row edge, so the first and last node of a group
 * end the line rather than leaving it hanging into the whitespace.
 */
export function Rail({ capTop, capBottom }: { capTop?: boolean; capBottom?: boolean }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 9,
        top: capTop ? DOT_MID : 0,
        ...(capBottom ? { height: capTop ? 0 : DOT_MID } : { bottom: 0 }),
        width: 2,
        backgroundColor: C.hair,
      }}
    />
  );
}

/**
 * Each row draws its OWN slice of the rail rather than the list drawing one
 * long line: History is virtualised and unmounts rows as they leave the
 * screen, so a single continuous rail would be cut wherever windowing
 * decided. Stacked segments are seamless and survive recycling.
 */
export function WorkoutRow({
  workout,
  prCount,
  points,
  muscles,
  gapDays = null,
  first,
  last,
  onPress,
  onDelete,
}: {
  workout: Workout;
  prCount: number;
  points: number;
  muscles: string[];
  /** Rest days between this session and the older one below it (History). */
  gapDays?: number | null;
  /** First / last of its group, so the rail can cap at the dot. */
  first: boolean;
  last: boolean;
  onPress: () => void;
  /** Omitted where deleting does not belong (Home's recents). */
  onDelete?: () => void;
}) {
  const d = new Date(workout.startedAt);
  const when =
    `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ` +
    `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sets = workoutSets(workout);
  const meta = [
    workout.endedAt ? fmtDuration(workout.startedAt, workout.endedAt) : null,
    `${sets} set${sets === 1 ? "" : "s"}`,
    `${workout.entries.length} exercise${workout.entries.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasPr = prCount > 0;

  return (
    <View>
      <Pressable onPress={onPress}>
        <View style={{ paddingLeft: 30, paddingVertical: 12 }}>
          <Rail capTop={first} capBottom={last} />
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 19,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: hasPr ? C.accent : C.page,
              borderWidth: 2,
              borderColor: hasPr ? C.accent : C.inkFaint,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt size={10} weight="extrabold" color={C.inkFaint} style={{ letterSpacing: 1, flex: 1 }}>
              {when.toUpperCase()}
            </Txt>
            {onDelete ? (
              <Pressable hitSlop={10} onPress={onDelete}>
                <Icon name="Trash2" size={15} color={C.inkFaint} />
              </Pressable>
            ) : null}
          </View>
          <Txt size={16} weight="extrabold" style={{ marginTop: 2 }} numberOfLines={1}>
            {workout.name}
          </Txt>
          <Txt size={11.5} color={C.inkFaint} style={{ marginTop: 2 }}>{meta}</Txt>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            {hasPr ? <Chip tone="gold" text={`${prCount} PR${prCount === 1 ? "" : "s"}`} /> : null}
            {points >= 1 ? <Chip tone="accent" text={`+${Math.round(points)} pts`} /> : null}
            {muscles.map((m) => (
              <Chip key={m} text={m} />
            ))}
          </View>
        </View>
      </Pressable>

      {gapDays != null && gapDays > 0 ? (
        <View style={{ paddingLeft: 30, paddingVertical: 7 }}>
          <Rail />
          <View
            style={{
              position: "absolute",
              left: 5,
              top: 11,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: C.page,
              borderWidth: 1.5,
              borderColor: C.line,
            }}
          />
          <Txt size={10.5} weight="bold" color={C.inkFaint} style={{ letterSpacing: 0.6 }}>
            {gapDays === 1 ? "1 day off" : `${gapDays} days off`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
