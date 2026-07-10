/**
 * Scrubbable date ruler (nutrition-app reference): a horizontal snap
 * scroller of day numbers — the centered day is big and dark, neighbors
 * shrink and fade (scroll-driven native interpolations) — over a tick
 * ruler that scrolls along (5 ticks per day, taller center tick), with a
 * fixed ▲ caret marking the selection point.
 *
 * Window: WINDOW_DAYS back from today, ending at today (future days don't
 * exist, so the scroll physically can't select one). External `date`
 * changes (calendar pick) scroll the ruler; user scrolls call `onChange`
 * with the snapped local-midnight ms.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, View, useWindowDimensions } from "react-native";
import { C, FONT } from "../theme";

const ITEM_W = 54;
const WINDOW_DAYS = 365;
const DAY_MS = 86400000;

/** Local midnight of the given ms. */
export function dayStart(ms: number): number {
  return new Date(ms).setHours(0, 0, 0, 0);
}

/** Local midnight `n` days away from the given local midnight (DST-safe —
 *  adding fixed 24h blocks drifts an hour across clock changes). */
export function addDays(dayMs: number, n: number): number {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

function Ticks() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-evenly",
        width: ITEM_W,
        height: 14,
      }}
    >
      {[8, 8, 14, 8, 8].map((h, i) => (
        <View
          key={i}
          style={{ width: 2, height: h, borderRadius: 1, backgroundColor: "rgba(20,26,24,0.18)" }}
        />
      ))}
    </View>
  );
}

export function DateRuler({
  date,
  onChange,
}: {
  /** Selected day, local-midnight ms. */
  date: number;
  onChange: (dayMs: number) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const ref = useRef<Animated.FlatList<number>>(null);
  const selfDriven = useRef(false);

  const today = dayStart(Date.now());
  // Seed at the initial offset so the selected cell renders big before the
  // first scroll event fires (a 0 seed styles the oldest cell as centered).
  const [scrollX] = useState(
    () =>
      new Animated.Value(
        (WINDOW_DAYS - Math.round((today - dayStart(date)) / DAY_MS)) * ITEM_W,
      ),
  );
  // Index 0 = oldest day; last index = today. Calendar math per entry so
  // every element is a true local midnight even across DST changes.
  const days = useMemo(
    () => Array.from({ length: WINDOW_DAYS + 1 }, (_, i) => addDays(today, i - WINDOW_DAYS)),
    [today],
  );
  // Rounding absorbs the ±1h DST offset in the raw ms difference.
  const indexOf = (ms: number) =>
    Math.max(0, Math.min(WINDOW_DAYS, WINDOW_DAYS - Math.round((today - dayStart(ms)) / DAY_MS)));

  const sidePad = (screenW - ITEM_W) / 2;

  // Calendar picks (or any external change) scroll the ruler into place.
  useEffect(() => {
    if (selfDriven.current) {
      selfDriven.current = false;
      return;
    }
    ref.current?.scrollToOffset({ offset: indexOf(date) * ITEM_W, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <View>
      <Animated.FlatList
        ref={ref}
        data={days}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(ms) => String(ms)}
        getItemLayout={(_, index) => ({ length: ITEM_W, offset: index * ITEM_W, index })}
        initialScrollIndex={indexOf(date)}
        snapToInterval={ITEM_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePad }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = Math.max(
            0,
            Math.min(WINDOW_DAYS, Math.round(e.nativeEvent.contentOffset.x / ITEM_W)),
          );
          if (days[i] !== date) {
            selfDriven.current = true;
            onChange(days[i]);
          }
        }}
        renderItem={({ item: ms, index }) => {
          const center = index * ITEM_W;
          const inputRange = [center - 2 * ITEM_W, center, center + 2 * ITEM_W];
          return (
            <Pressable
              onPress={() =>
                ref.current?.scrollToOffset({ offset: center, animated: true })
              }
            >
              <View style={{ width: ITEM_W, alignItems: "center" }}>
                <View style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                  {/* Two stacked layers crossfaded — text color can't run on
                      the native driver, scale + opacity can. */}
                  <Animated.Text
                    style={{
                      fontFamily: FONT.extrabold,
                      fontSize: 22,
                      color: C.inkFaint,
                      transform: [
                        {
                          scale: scrollX.interpolate({
                            inputRange,
                            outputRange: [0.72, 1.25, 0.72],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    }}
                  >
                    {new Date(ms).getDate()}
                  </Animated.Text>
                  <Animated.Text
                    style={{
                      position: "absolute",
                      fontFamily: FONT.extrabold,
                      fontSize: 22,
                      color: C.ink,
                      opacity: scrollX.interpolate({
                        inputRange: [center - ITEM_W, center, center + ITEM_W],
                        outputRange: [0, 1, 0],
                        extrapolate: "clamp",
                      }),
                      transform: [
                        {
                          scale: scrollX.interpolate({
                            inputRange,
                            outputRange: [0.72, 1.25, 0.72],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    }}
                  >
                    {new Date(ms).getDate()}
                  </Animated.Text>
                </View>
                <Ticks />
              </View>
            </Pressable>
          );
        }}
      />
      {/* Fixed caret under the centered day. */}
      <View style={{ alignItems: "center", marginTop: 2 }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 6,
            borderRightWidth: 6,
            borderBottomWidth: 7,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: C.ink,
          }}
        />
      </View>
    </View>
  );
}
