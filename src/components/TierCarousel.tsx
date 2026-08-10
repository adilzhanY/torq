/**
 * The ladder as a CAROUSEL (Adilzhan, 2026-08-09: "don't show it like a
 * grid. better show ranks as a horizontally scrollable component. show
 * previous and future ones as smaller ones, and when scrolled show them
 * bigger in the center… but show lock icon on future ones, and show
 * achieved date on previous ranks").
 *
 * It replaces the separate hero badge too: the centred card IS the hero, so
 * landing on the screen you see your own tier at full size, and swiping
 * either way walks the whole ladder, earned tiers behind you with the date
 * you got them, locked ones ahead with what they cost.
 *
 * Mechanics follow DateRuler, which already solved this in this codebase:
 * one scrollX Animated.Value drives every item's scale and opacity on the
 * NATIVE driver, so flicking through nine badges never touches the JS
 * thread. The caption underneath is the one thing that needs JS, and it is
 * updated from a scroll listener guarded on the index actually changing.
 *
 * Items are laid out at a FIXED slot width while the centred badge scales
 * past it. The numbers are chosen so the big badge's edge (SLOT_W × SCALE_C
 * ÷ 2) still clears its neighbour's, overlapping cards would read as a
 * stack, not a ladder.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, useWindowDimensions, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { Txt } from "./ui";
import { RankBadge } from "./RankBadge";
import { TIER_FLOOR } from "../lib/progress";
import { TIER_COLORS, TIER_NAMES, stageOf, type TierName, type TierState } from "../lib/rank";

/**
 * Horizontal slot per tier. The badge scales beyond its slot; the slot does
 * not move. The numbers are solved, not guessed: the centred badge renders
 * BADGE × SCALE_CENTER = 240 wide, so its edge sits 120 from centre, while a
 * neighbour's inner edge sits SLOT_W − (BADGE × SCALE_NEAR)/2 = 133 away.
 * 13 px of daylight, any tighter and the cards read as a stack.
 */
const SLOT_W = 172;
const BADGE = 150;
const SCALE_CENTER = 1.6;
const SCALE_NEAR = 0.52;
const SCALE_FAR = 0.42;
/** Layout height must reserve the SCALED badge, or it overlaps its heading. */
const ROW_H = Math.ceil(((BADGE * 136) / 170) * SCALE_CENTER);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function TierCarousel({
  state,
  dates,
  scale = 3,
  window: windowSize = 2,
}: {
  /** The user's own overall rank: decides what is earned and what is next. */
  state: TierState;
  /** Tier → when it was first reached (lib/progress tierDates). */
  dates: Map<TierName, number>;
  /** 1 for a single lift, 3 for the overall score. */
  scale?: number;
  /** How many tiers either side of the focused one actually draw a badge.
   *  Ranks passes 0 for the first frame and 2 once the tab has settled. */
  window?: number;
}) {
  const { width: screenW } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);

  const currentIndex = TIER_NAMES.reduce(
    (acc, name, i) => (state.points >= TIER_FLOOR[name] * scale ? i : acc),
    0,
  );
  const [focus, setFocus] = useState(currentIndex);
  const focusRef = useRef(currentIndex);

  // Side padding so the first and last tier can sit dead centre. The
  // carousel is rendered full-bleed, so the page gutter is NOT subtracted,
  // doing that shifted every centred badge 16 px to the left.
  const sidePad = Math.max(0, (screenW - SLOT_W) / 2);

  // Open on the user's own tier: the screen should look like their rank
  // card before it looks like a museum.
  useEffect(() => {
    const x = currentIndex * SLOT_W;
    scrollX.setValue(x);
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo?.({ x, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [currentIndex, scrollX]);

  const focused = TIER_NAMES[focus] ?? TIER_NAMES[currentIndex];
  const floor = Math.round(TIER_FLOOR[focused] * scale);
  const earned = focus <= currentIndex;
  const isCurrent = focus === currentIndex;
  const reachedAt = dates.get(focused);
  const toGo = Math.max(0, Math.ceil(floor - state.points));

  const items = useMemo(() => TIER_NAMES.map((n, i) => ({ name: n, i })), []);

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLOT_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePad, alignItems: "center" }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            // The badges animate natively; only the caption needs JS, and
            // only when the centred tier actually changes.
            listener: (e: any) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SLOT_W);
              const clamped = Math.min(TIER_NAMES.length - 1, Math.max(0, i));
              if (clamped !== focusRef.current) {
                focusRef.current = clamped;
                setFocus(clamped);
              }
            },
          },
        )}
      >
        {items.map(({ name, i }) => {
          const input = [
            (i - 2) * SLOT_W,
            (i - 1) * SLOT_W,
            i * SLOT_W,
            (i + 1) * SLOT_W,
            (i + 2) * SLOT_W,
          ];
          const isEarned = i <= currentIndex;
          return (
            <Pressable
              key={name}
              onPress={() => scrollRef.current?.scrollTo?.({ x: i * SLOT_W, animated: true })}
              style={{
                width: SLOT_W,
                height: ROW_H,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  opacity: scrollX.interpolate({
                    inputRange: input,
                    outputRange: [0.3, 0.55, 1, 0.55, 0.3],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    {
                      scale: scrollX.interpolate({
                        inputRange: input,
                        outputRange: [SCALE_FAR, SCALE_NEAR, SCALE_CENTER, SCALE_NEAR, SCALE_FAR],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                }}
              >
                {/* Locked tiers still show their real art (dimmed, never a
                    silhouette) and stand still. Motion is the reward.
                    Only the badges NEAR the centre are mounted: each one is a
                    2 500-character traced path, and drawing all nine at once
                    was a measurable share of the tab's open time. */}
                <View style={{ opacity: isEarned ? 1 : 0.5 }}>
                  {Math.abs(i - focus) <= windowSize ? (
                    <RankBadge
                      tier={name}
                      stage={i === currentIndex ? stageOf(state.progress) : 4}
                      size={BADGE}
                      animated={isEarned}
                    />
                  ) : (
                    <View style={{ width: BADGE, height: (BADGE * 136) / 170 }} />
                  )}
                </View>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>

      {/* Caption for whichever tier is centred. */}
      <View style={{ alignItems: "center", gap: 3, marginTop: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!earned ? <Icon name="Lock" size={13} color={C.inkFaint} /> : null}
          <Txt size={19} weight="extrabold" color={earned ? TIER_COLORS[focused] : C.inkSoft}>
            {focused}
          </Txt>
          {isCurrent ? (
            <View
              style={{
                backgroundColor: C.accent,
                borderRadius: R.pill,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Txt size={9.5} weight="extrabold" color={C.accentInk}>YOU</Txt>
            </View>
          ) : null}
        </View>

        <Txt size={12} color={C.inkFaint}>
          {isCurrent
            ? state.next
              ? `${floor} pts · ${Math.ceil(state.toNext)} to ${state.next}`
              : `${floor} pts · top of the ladder`
            : earned
              ? reachedAt
                ? `Reached ${fmtDate(reachedAt)}`
                : `${floor} pts`
              : `Needs ${floor} pts · ${toGo} to go`}
        </Txt>
      </View>
    </View>
  );
}
