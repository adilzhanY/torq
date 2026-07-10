/**
 * Torq's shared chart kit (all react-native-svg, clay-styled):
 *  - SegmentedBar → barcode-style progress (animated width mask).
 *  - ArcGauge → radial segmented gauge (animated tick sweep).
 *  - Sparkline → tiny unlabeled trend line.
 *  - LineChart → labeled trend line: y min/max, first/last date, area fill,
 *    lime dot on the latest point.
 *  - BarChart → vertical bars with value-on-top and x labels (weekly stats).
 *  - HBars → horizontal labeled bars (e.g. volume by muscle group).
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline } from "react-native-svg";
import { C } from "../theme";
import { Txt } from "./ui";

/** "10 Jul" */
function shortDate(ms: number): string {
  const d = new Date(ms);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

/** Compact value labels: 12800 → "12.8k". */
export function fmtShort(n: number): string {
  if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

/**
 * Labeled trend line for time series. Points must be in ascending x (ms).
 * Renders min/max y labels, first/last date labels, a soft area fill, and
 * a lime dot on the latest point.
 */
export function LineChart({
  points,
  height = 140,
  color = C.ink,
  formatY = fmtShort,
}: {
  points: { x: number; y: number }[];
  height?: number;
  color?: string;
  formatY?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  if (points.length === 0) return null;

  const ys = points.map((p) => p.y);
  const xs = points.map((p) => p.x);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const ySpan = yMax - yMin || 1;
  const xSpan = xMax - xMin || 1;
  const padX = 6;
  const padTop = 8;
  const padBottom = 8;

  const chartH = height - padTop - padBottom;
  const px = (x: number) => padX + ((x - xMin) / xSpan) * (Math.max(1, width) - 2 * padX);
  const py = (y: number) => padTop + (1 - (y - yMin) / ySpan) * chartH;
  const pts = points.map((p) => ({ x: px(p.x), y: py(p.y) }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${height - padBottom} ${line} ${pts[pts.length - 1].x},${height - padBottom}`;
  const last = pts[pts.length - 1];

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt size={10} weight="bold" color={C.inkFaint}>{formatY(yMax)}</Txt>
        <Txt size={10} weight="bold" color={C.inkFaint}>
          {points.length === 1 ? "" : `min ${formatY(yMin)}`}
        </Txt>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {points.length > 1 ? (
              <>
                <Polygon points={area} fill={color} opacity={0.08} />
                <Polyline
                  points={line}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : null}
            <Circle cx={last.x} cy={last.y} r={4.5} fill={C.accent} stroke={C.ink} strokeWidth={1.5} />
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt size={10} weight="bold" color={C.inkFaint}>{shortDate(xMin)}</Txt>
        <Txt size={10} weight="bold" color={C.inkFaint}>{shortDate(xMax)}</Txt>
      </View>
    </View>
  );
}

/** Vertical bars with the value on top and a label under each bar. */
export function BarChart({
  bars,
  height = 120,
  color = C.ink,
  formatValue = fmtShort,
}: {
  bars: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
      {bars.map((b, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <Txt size={9} weight="bold" color={C.inkFaint}>
            {b.value > 0 ? formatValue(b.value) : ""}
          </Txt>
          <View
            style={{
              alignSelf: "stretch",
              height: Math.max(3, (b.value / max) * height),
              borderRadius: 5,
              backgroundColor: b.highlight ? C.accent : b.value > 0 ? color : C.page2,
            }}
          />
          <Txt size={9} weight="bold" color={C.inkFaint} numberOfLines={1}>
            {b.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Horizontal labeled bars (largest first looks best — caller sorts). */
export function HBars({
  rows,
  formatValue = fmtShort,
}: {
  rows: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt size={11} weight="bold" color={C.inkSoft}>{r.label}</Txt>
            <Txt size={11} weight="extrabold">{formatValue(r.value)}</Txt>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: C.page2, overflow: "hidden" }}>
            <View
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                height: "100%",
                borderRadius: 5,
                backgroundColor: r.color ?? C.ink,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Progress 0..1, clamped. */
function pct(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

const BAR_W = 7;
const BAR_GAP = 5;
const BAR_H = 38;

function Bars({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: BAR_GAP }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{ width: BAR_W, height: BAR_H, borderRadius: BAR_W / 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

/**
 * Barcode progress bar: gray base bars with an ink overlay clipped by an
 * animated-width mask. Fills lime once the goal is reached.
 */
export function SegmentedBar({ value, goal }: { value: number; goal: number }) {
  const [width, setWidth] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;
  const p = pct(value, goal);
  const done = goal > 0 && value >= goal;
  const count = width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  const innerW = count * (BAR_W + BAR_GAP) - BAR_GAP;

  useEffect(() => {
    if (!width) return;
    Animated.timing(fill, {
      toValue: p * innerW,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width is layout
    }).start();
  }, [p, width, innerW, fill]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {count > 0 ? (
        <View>
          <Bars count={count} color={C.page2} />
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: fill,
              overflow: "hidden",
            }}
          >
            <Bars count={count} color={done ? C.accent : C.ink} />
          </Animated.View>
        </View>
      ) : (
        <View style={{ height: BAR_H }} />
      )}
    </View>
  );
}

/**
 * Tiny trend line (7-day volume teaser on Home): normalized polyline with a
 * lime dot on the last point. Width fills the container via onLayout.
 */
export function Sparkline({ data, height = 40 }: { data: number[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const max = Math.max(...data, 1);
  const pad = 5; // keeps the dot and round joins inside the viewBox
  const pts = data.map((v, i) => ({
    x: pad + (i / Math.max(1, data.length - 1)) * (width - 2 * pad),
    y: pad + (1 - v / max) * (height - 2 * pad),
  }));
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && data.length > 1 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={C.ink}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={pts[pts.length - 1].x}
            cy={pts[pts.length - 1].y}
            r={4}
            fill={C.accent}
            stroke={C.ink}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const TICKS = 24;
const ARC_DEG = 270; // gap opens at the bottom
const TICK_LEN = 9;

/**
 * Radial segmented gauge. `progress` sweeps in tick by tick via an animated
 * counter (SVG props aren't natively animatable, so the Animated.Value
 * drives React state through a listener — 24 discrete steps is cheap).
 */
export function ArcGauge({
  value,
  goal,
  label,
  color,
  size = 96,
}: {
  value: number;
  goal: number;
  label: string;
  color: string;
  size?: number;
}) {
  const target = Math.round(pct(value, goal) * TICKS);
  const [lit, setLit] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = anim.addListener(({ value: v }) => setLit(Math.round(v)));
    Animated.timing(anim, {
      toValue: target,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(sub);
  }, [target, anim]);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - TICK_LEN;
  // β: degrees clockwise from 12 o'clock. Sweep bottom-left → top →
  // bottom-right, leaving the 90° gap at the bottom.
  const start = 180 + ARC_DEG / 2;

  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          {Array.from({ length: TICKS }, (_, i) => {
            const b = ((start + (i / (TICKS - 1)) * ARC_DEG) * Math.PI) / 180;
            const dx = Math.sin(b);
            const dy = -Math.cos(b); // screen y grows downward
            return (
              <Line
                key={i}
                x1={cx + dx * rInner}
                y1={cy + dy * rInner}
                x2={cx + dx * rOuter}
                y2={cy + dy * rOuter}
                stroke={i < lit ? color : C.page2}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
        <Txt size={16} weight="extrabold">{value}</Txt>
        <Txt size={10} weight="bold" color={C.inkFaint}>/{goal}</Txt>
      </View>
      <Txt size={10} weight="bold" color={C.inkFaint}>{label}</Txt>
    </View>
  );
}
