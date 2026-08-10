/**
 * Friends compare (PATH.md Phase 3): you and one friend, side by side.
 *
 * Comparison is by DOTS POINTS, never by raw kilos. That is the whole
 * premise of the rank engine. A 60 kg lifter and a 95 kg lifter benching
 * the same weight are not equal, and a compare screen that pretends
 * otherwise would undo the normalization. Each side still shows its own
 * e1RM in its own unit, so nobody has to do maths in their head.
 */
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { useEffect } from "react";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { SlideUp } from "./anim";
import { Divider, Eyebrow, Txt } from "./ui";
import { RankBadge } from "./RankBadge";
import { useStore } from "../lib/store";
import { bodyProfileAt } from "../lib/calories";
import {
  overallRank,
  rankLifts,
  stageOf,
  TIER_NAMES,
  type TierName,
} from "../lib/rank";
import type { Friend } from "../lib/social";

function asTier(name: string): TierName {
  return (TIER_NAMES as readonly string[]).includes(name) ? (name as TierName) : "Rust";
}

/** Names differ in case/spacing across libraries: compare on a slug. */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface Side {
  label: string;
  points: number;
  tier: TierName;
  stage: 1 | 2 | 3 | 4;
  lifts: { name: string; e1RM: number; unit: string; points: number }[];
}

/** One head-to-head row: the higher points wins the lime. */
function LiftRow({
  name,
  mine,
  theirs,
}: {
  name: string;
  mine?: { e1RM: number; unit: string; points: number };
  theirs?: { e1RM: number; unit: string; points: number };
}) {
  const myPts = mine?.points ?? -1;
  const theirPts = theirs?.points ?? -1;
  const iWin = myPts > theirPts;
  const theyWin = theirPts > myPts;
  const cell = (
    v: { e1RM: number; unit: string; points: number } | undefined,
    win: boolean,
  ) => (
    <View style={{ width: 92, alignItems: "center", gap: 1 }}>
      <Txt size={15} weight="extrabold" color={win ? C.accent : v ? C.ink : C.inkFaint}>
        {v ? `${v.e1RM} ${v.unit}` : "-"}
      </Txt>
      <Txt size={10} weight="bold" color={C.inkFaint}>
        {v ? `${Math.round(v.points)} pts` : "not logged"}
      </Txt>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9 }}>
      {cell(mine, iWin)}
      <Txt
        size={12.5}
        weight="semibold"
        color={C.inkSoft}
        numberOfLines={2}
        style={{ flex: 1, textAlign: "center" }}
      >
        {name}
      </Txt>
      {cell(theirs, theyWin)}
    </View>
  );
}

export function FriendCompare({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const { workouts, exercises, measurements, settings } = useStore();

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const body = bodyProfileAt(settings, measurements, Date.now());
  const myLifts = rankLifts(workouts, settings.unit, body.weightKg, body.sex);
  const myOverall = overallRank(myLifts);

  const me: Side = {
    label: settings.name?.trim() || "You",
    points: myOverall.state.points,
    tier: myOverall.state.tier,
    stage: stageOf(myOverall.state.progress),
    lifts: myLifts.map((l) => ({
      name: exercises.find((e) => e.id === l.exerciseId)?.name ?? "Exercise",
      e1RM: l.e1RM,
      unit: settings.unit,
      points: l.points,
    })),
  };

  const s = friend.snapshot;
  const them: Side = {
    label: friend.displayName,
    points: s?.points ?? 0,
    tier: asTier(s?.tier ?? "Rust"),
    stage: s?.stage ?? 1,
    lifts: (s?.lifts ?? []).map((l) => ({
      name: l.name,
      e1RM: l.e1RM,
      unit: l.unit,
      points: l.points,
    })),
  };

  // Union of both lift lists, strongest pair first. Their snapshot only
  // carries the top 5, so "not logged" here can also mean "outside their
  // top five". The caption says so rather than implying they never did it.
  const bySlug = new Map<string, { name: string; mine?: Side["lifts"][number]; theirs?: Side["lifts"][number] }>();
  for (const l of me.lifts) bySlug.set(slug(l.name), { name: l.name, mine: l });
  for (const l of them.lifts) {
    const k = slug(l.name);
    const row = bySlug.get(k);
    if (row) row.theirs = l;
    else bySlug.set(k, { name: l.name, theirs: l });
  }
  const rows = [...bySlug.values()].sort(
    (a, b) =>
      Math.max(b.mine?.points ?? 0, b.theirs?.points ?? 0) -
      Math.max(a.mine?.points ?? 0, a.theirs?.points ?? 0),
  );

  const lead = me.points - them.points;

  const Column = ({ side }: { side: Side }) => (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <RankBadge tier={side.tier} stage={side.stage} size={104} />
      <Txt size={14} weight="extrabold" numberOfLines={1} style={{ maxWidth: 130 }}>
        {side.label}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Txt size={26} weight="extrabold" color={C.accent}>
          {Math.round(side.points)}
        </Txt>
        <Txt size={11} weight="extrabold" color={C.accent}>pts</Txt>
      </View>
      <Txt size={11} color={C.inkSoft}>{side.tier}</Txt>
    </View>
  );

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 6,
        }}
      >
        <Pressable hitSlop={8} onPress={onClose}>
          <Icon name="ChevronLeft" size={24} color={C.ink} />
        </Pressable>
        <Txt size={20} weight="extrabold" style={{ flex: 1 }} numberOfLines={1}>
          You vs @{friend.handle}
        </Txt>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Column side={me} />
          <View style={{ paddingTop: 26, alignItems: "center" }}>
            <Txt size={12} weight="extrabold" color={C.inkFaint}>VS</Txt>
          </View>
          <Column side={them} />
        </View>

        <View
          style={{
            marginTop: 16,
            borderRadius: R.sm,
            backgroundColor: C.page2,
            borderWidth: 1,
            borderColor: C.line,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Txt size={13} weight="bold" color={lead >= 0 ? C.accent : C.inkSoft} style={{ textAlign: "center" }}>
            {!s
              ? "They haven't published a rank yet."
              : Math.abs(lead) < 1
                ? "Dead even. Someone has to break the tie."
                : lead > 0
                  ? `You lead by ${Math.round(lead)} points.`
                  : `${friend.displayName} leads by ${Math.round(-lead)} points.`}
          </Txt>
        </View>

        <Eyebrow>Lift by lift</Eyebrow>
        <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 4 }}>
          <Txt size={10} weight="bold" color={C.inkFaint} style={{ width: 92, textAlign: "center" }}>
            YOU
          </Txt>
          <View style={{ flex: 1 }} />
          <Txt size={10} weight="bold" color={C.inkFaint} style={{ width: 92, textAlign: "center" }}>
            THEM
          </Txt>
        </View>
        {rows.length === 0 ? (
          <Txt size={13} color={C.inkFaint}>
            Nothing to compare yet: neither of you has a ranked lift.
          </Txt>
        ) : (
          rows.map((r, i) => (
            <View key={slug(r.name)}>
              {i > 0 ? <Divider /> : null}
              <LiftRow name={r.name} mine={r.mine} theirs={r.theirs} />
            </View>
          ))
        )}
        <Txt size={10} color={C.inkFaint} style={{ marginTop: 8 }}>
          Ranked on DOTS points, so bodyweight and sex are already accounted
          for. The heavier lift doesn't automatically win. A friend's list
          holds their top 5 lifts only.
        </Txt>
      </ScrollView>
    </SlideUp>
  );
}
