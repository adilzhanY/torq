/**
 * Premium chart kit on react-native-gifted-charts (reference: iOS-style
 * strength-app card — curved line, grid, touch tooltip, goal line, range
 * selector, metric chips, min/max tiles, stacked muscle bar):
 *
 *  - TrendLine → curved area line with grid, y-axis, sparse date labels, an
 *    optional dashed reference line (e.g. all-time PR) and a press-and-hold
 *    tooltip ("Tue, 27 Mar · 128 kg").
 *  - ProBars → rounded bars, values on top, lime highlight.
 *  - RangePills / MetricPills → the 14D…All selector and metric chips.
 *  - MinMaxTiles → the gray min/max tiles under a chart.
 *  - MuscleBreakdown → one stacked bar + legend dots (monochrome ink ramp).
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { C, FONT, R } from "../theme";
import { Txt } from "./ui";
import { fmtShort } from "./charts";

const GRID = "rgba(20,26,24,0.08)";
const AXIS_TEXT = { color: C.inkFaint, fontSize: 10, fontFamily: FONT.bold };

const DAYS3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS3[d.getMonth()]}`;
}

function tooltipDate(ms: number): string {
  const d = new Date(ms);
  return `${DAYS3[d.getDay()]}, ${d.getDate()} ${MONTHS3[d.getMonth()]}`;
}

/** The 14D / 1M / 3M / 6M / 12M / All selector. */
export const RANGES = ["14D", "1M", "3M", "6M", "12M", "All"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_DAYS: Record<RangeKey, number> = {
  "14D": 14,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "12M": 365,
  All: Infinity,
};

export function RangePills({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: C.page2,
        borderRadius: R.pill,
        padding: 4,
      }}
    >
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: R.pill,
              backgroundColor: active ? C.primary : "transparent",
              alignItems: "center",
            }}
          >
            <Txt size={12} weight={active ? "extrabold" : "bold"} color={active ? "#fff" : C.inkSoft}>
              {r}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Outlined metric chips (1 Rep Max / Volume …). */
export function MetricPills<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: R.pill,
              borderWidth: 1.5,
              borderColor: active ? C.ink : "transparent",
              backgroundColor: active ? "rgba(200,254,35,0.18)" : C.page2,
            }}
          >
            <Txt size={12} weight="extrabold" color={active ? C.ink : C.inkFaint}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The hero chart: curved area line, light grid, sparse date labels, press
 * (and drag) tooltip, optional dashed reference line. Points ascending by x.
 */
export function TrendLine({
  points,
  unit,
  color = C.ink,
  height = 200,
  goal,
  formatValue = fmtShort,
}: {
  points: { x: number; y: number }[];
  unit: string;
  color?: string;
  height?: number;
  /** Dashed reference line, e.g. { value: allTimePR, label: "PR 92" }. */
  goal?: { value: number; label: string };
  formatValue?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  if (points.length === 0) return null;

  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys, goal ? goal.value : Infinity);
  const yMax = Math.max(...ys, goal ? goal.value : -Infinity);
  const span = Math.max(1, yMax - yMin);
  // Floor the axis near the data (the reference chart doesn't start at 0).
  const offset = Math.max(0, Math.floor(yMin - span * 0.25));
  const top = Math.ceil(yMax + span * 0.2 - offset);

  // Sparse x labels: ~4 evenly spaced.
  const every = Math.max(1, Math.ceil(points.length / 4));
  const data = points.map((p, i) => ({
    value: p.y,
    at: p.x,
    label: i % every === 0 ? shortDate(p.x) : "",
    labelTextStyle: { ...AXIS_TEXT, width: 44 },
  }));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <LineChart
          data={data}
          width={width - 44}
          height={height}
          adjustToWidth
          parentWidth={width - 8}
          curved
          curvature={0.2}
          thickness={3}
          color={color}
          areaChart
          startFillColor={color}
          endFillColor={color}
          startOpacity={0.14}
          endOpacity={0.01}
          hideDataPoints={points.length > 20}
          dataPointsColor={color}
          dataPointsRadius={3.5}
          yAxisOffset={offset}
          maxValue={top}
          noOfSections={4}
          rulesColor={GRID}
          rulesType="solid"
          showVerticalLines
          verticalLinesColor={GRID}
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisTextStyle={AXIS_TEXT}
          yAxisLabelWidth={36}
          initialSpacing={8}
          endSpacing={8}
          showReferenceLine1={!!goal}
          // gifted subtracts yAxisOffset internally — pass the raw value.
          referenceLine1Position={goal ? goal.value : 0}
          referenceLine1Config={{
            color: C.goodAcc,
            thickness: 1.5,
            dashWidth: 5,
            dashGap: 5,
            labelText: goal?.label ?? "",
            labelTextStyle: {
              color: C.goodAcc,
              fontSize: 9,
              fontFamily: FONT.extrabold,
              marginTop: -14,
            },
          }}
          pointerConfig={{
            activatePointersOnLongPress: true,
            activatePointersDelay: 120,
            pointerStripColor: "rgba(20,26,24,0.25)",
            pointerStripWidth: 1.5,
            pointerStripUptoDataPoint: true,
            pointerColor: C.accent,
            radius: 6,
            pointerLabelWidth: 120,
            pointerLabelHeight: 56,
            autoAdjustPointerLabelPosition: true,
            pointerVanishDelay: 900,
            pointerLabelComponent: (items: { value: number; at?: number }[]) => {
              const it = items[0];
              return (
                <View
                  style={{
                    backgroundColor: C.primary,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    alignItems: "center",
                    marginTop: -6,
                  }}
                >
                  <Txt size={10} weight="bold" color="rgba(255,255,255,0.65)">
                    {it.at ? tooltipDate(it.at) : ""}
                  </Txt>
                  <Txt size={15} weight="extrabold" color={C.accent}>
                    {formatValue(it.value)} {unit}
                  </Txt>
                </View>
              );
            },
          }}
        />
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** Rounded bars with values on top; highlighted bars go lime. */
export function ProBars({
  bars,
  height = 140,
  formatValue = fmtShort,
}: {
  bars: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const n = Math.max(1, bars.length);
  const barWidth = width > 0 ? Math.max(10, (width - 44) / n - 10) : 20;
  // Pin the axis to the data — gifted's auto max leaves short bars swimming.
  const top = Math.max(1, Math.ceil(Math.max(...bars.map((b) => b.value), 1) * 1.2));
  const data = bars.map((b) => ({
    value: b.value,
    label: b.label,
    labelTextStyle: AXIS_TEXT,
    frontColor: b.highlight ? C.accent : C.ink,
    topLabelComponent: () => (
      <Txt size={9} weight="bold" color={C.inkFaint}>
        {b.value > 0 ? formatValue(b.value) : ""}
      </Txt>
    ),
  }));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <BarChart
          data={data}
          height={height}
          barWidth={barWidth}
          spacing={10}
          initialSpacing={4}
          barBorderRadius={6}
          maxValue={top}
          noOfSections={3}
          rulesType="solid"
          rulesColor={GRID}
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisTextStyle={AXIS_TEXT}
          yAxisLabelWidth={34}
          isAnimated
          animationDuration={500}
          disableScroll
        />
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** The gray Min / Max tiles under the hero chart. */
export function MinMaxTiles({
  min,
  max,
  unit,
  formatValue = fmtShort,
}: {
  min: number;
  max: number;
  unit: string;
  formatValue?: (v: number) => string;
}) {
  const tile = (value: number, label: string) => (
    <View
      style={{
        flex: 1,
        backgroundColor: C.page2,
        borderRadius: R.sm,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 2,
      }}
    >
      <Txt size={17} weight="extrabold">
        {formatValue(value)} {unit}
      </Txt>
      <Txt size={11} weight="bold" color={C.inkFaint}>{label}</Txt>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {tile(min, "Min")}
      {tile(max, "Max")}
    </View>
  );
}

/** Ink ramp for the stacked breakdown segments (largest → faintest). */
const RAMP = [
  "rgba(26,27,26,1)",
  "rgba(26,27,26,0.72)",
  "rgba(26,27,26,0.5)",
  "rgba(26,27,26,0.32)",
  "rgba(26,27,26,0.16)",
];

/** One stacked horizontal bar + legend dots (reference: Muscle Breakdown). */
export function MuscleBreakdown({
  rows,
  caption,
}: {
  /** Pre-sorted descending; ≤5 rows read best (fold the tail into "Other"). */
  rows: { label: string; value: number }[];
  caption?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          height: 28,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: C.page2,
        }}
      >
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={{
              flex: Math.max(0.02, r.value / total),
              backgroundColor: RAMP[Math.min(i, RAMP.length - 1)],
              // Hairline separators between segments.
              borderRightWidth: i < rows.length - 1 ? 2 : 0,
              borderRightColor: C.surface,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {rows.map((r, i) => (
          <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: RAMP[Math.min(i, RAMP.length - 1)],
                borderWidth: i >= 3 ? 1 : 0,
                borderColor: "rgba(20,26,24,0.2)",
              }}
            />
            <Txt size={11} weight="bold" color={C.inkSoft}>
              {r.label} · {Math.round((r.value / total) * 100)}%
            </Txt>
          </View>
        ))}
      </View>
      {caption ? (
        <Txt size={11} color={C.inkFaint}>{caption}</Txt>
      ) : null}
    </View>
  );
}
