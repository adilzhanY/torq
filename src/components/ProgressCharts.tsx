/**
 * The two charts the Stats rebuild is built on (lavish review
 * `.lavish/torq-stats.html`, 2026-08-09).
 *
 * Form follows the reader's job, not the data's shape:
 *
 *  - `RankLine`: "am I climbing?" ONE series over time with the tier ladder
 *    painted behind it. One series means emphasis, not categorical: no
 *    legend (the title names it) and exactly one direct label, at the
 *    endpoint. The bands are an ORDINAL ramp (the ladder is ordered), held
 *    at low alpha so they read as context and never compete with the line.
 *  - `Dumbbell`: "what moved?" before → after per lift. Pairs read as pairs
 *    and the GAP is the subject, which grouped bars hide. One hue in two
 *    treatments (hollow = then, filled = now) rather than two hues, so the
 *    colour channel stays free.
 *
 * Both are hand-rolled react-native-svg rather than gifted-charts: neither
 * form exists in that library, and banding + paired dots are less code than
 * bending a line chart into them.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { C, FONT } from "../theme";
import { Txt } from "./ui";
import { TIER_COLORS, TIER_NAMES, type TierName } from "../lib/rank";
import type { RankPoint } from "../lib/progress";

/** Overall-scale tier floors: the per-lift thresholds × 3 (see rank.ts). */
const OVERALL_FLOOR: { tier: TierName; floor: number }[] = [
  { tier: "Rust", floor: 0 },
  { tier: "Iron", floor: 90 },
  { tier: "Bronze", floor: 135 },
  { tier: "Silver", floor: 180 },
  { tier: "Gold", floor: 225 },
  { tier: "Platinum", floor: 285 },
  { tier: "Diamond", floor: 345 },
  { tier: "Elite", floor: 420 },
  { tier: "World Class", floor: 495 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function RankLine({
  points,
  height = 190,
  width,
}: {
  points: RankPoint[];
  height?: number;
  /** Measured width from the parent; the chart is useless before it lands. */
  width: number;
}) {
  if (width <= 0 || points.length < 2) return <View style={{ height }} />;

  const padR = 54; // room for the tier names on the right edge
  const padT = 10;
  const padB = 20;
  const plotW = Math.max(1, width - padR);
  const plotH = Math.max(1, height - padT - padB);

  // Y window: the data, padded, and always wide enough to show the band the
  // user is in plus the one above, the point of the chart is the next tier.
  const lo = Math.min(...points.map((p) => p.points));
  const hi = Math.max(...points.map((p) => p.points));
  const idx = OVERALL_FLOOR.reduce((acc, t, i) => (hi >= t.floor ? i : acc), 0);
  const nextFloor = OVERALL_FLOOR[idx + 1]?.floor ?? hi * 1.1;
  const y0 = Math.max(0, Math.min(lo - 10, OVERALL_FLOOR[idx].floor - 5));
  // The band ABOVE is the target ("9 pts to Gold"), so leave enough headroom
  // that it is tall enough to carry its own name, an unlabelled target band
  // is just a stripe.
  const y1 = Math.max(hi + 10, nextFloor + Math.max(14, (nextFloor - OVERALL_FLOOR[idx].floor) * 0.2));
  const span = Math.max(1, y1 - y0);

  const px = (i: number) => (i * plotW) / (points.length - 1);
  const py = (v: number) => padT + (1 - (v - y0) / span) * plotH;

  let d = "";
  points.forEach((p, i) => {
    d += `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(p.points).toFixed(1)}`;
  });
  const area = `${d}L${px(points.length - 1).toFixed(1)} ${py(y0).toFixed(1)}L0 ${py(y0).toFixed(1)}Z`;

  const first = new Date(points[0].at);
  const last = new Date(points[points.length - 1].at);
  const mid = new Date(points[Math.floor(points.length / 2)].at);
  const endX = px(points.length - 1);
  const endY = py(points[points.length - 1].points);

  return (
    <Svg width={width} height={height}>
      {/* Bands, drawn first so the line sits on top of them. */}
      {OVERALL_FLOOR.map((t, i) => {
        const ceil = OVERALL_FLOOR[i + 1]?.floor ?? y1;
        if (ceil <= y0 || t.floor >= y1) return null;
        const top = py(Math.min(ceil, y1));
        const bottom = py(Math.max(t.floor, y0));
        const h = bottom - top;
        if (h <= 0) return null;
        return (
          <Rect
            key={`b${t.tier}`}
            x={0}
            y={top}
            width={plotW}
            height={h}
            fill={TIER_COLORS[t.tier]}
            opacity={0.06}
          />
        );
      })}
      {OVERALL_FLOOR.map((t, i) => {
        const ceil = OVERALL_FLOOR[i + 1]?.floor ?? y1;
        if (ceil <= y0 || t.floor >= y1) return null;
        const top = py(Math.min(ceil, y1));
        const bottom = py(Math.max(t.floor, y0));
        if (bottom - top < 14) return null;
        return (
          <SvgText
            key={`t${t.tier}`}
            x={plotW + 7}
            y={top + 11}
            fill={TIER_COLORS[t.tier]}
            fontSize={8}
            fontFamily={FONT.bold}
          >
            {t.tier}
          </SvgText>
        );
      })}
      {OVERALL_FLOOR.map((t) => {
        if (t.floor <= y0 || t.floor >= y1) return null;
        return (
          <Line
            key={`l${t.tier}`}
            x1={0}
            y1={py(t.floor)}
            x2={plotW}
            y2={py(t.floor)}
            stroke={TIER_COLORS[t.tier]}
            strokeOpacity={0.3}
            strokeWidth={1}
          />
        );
      })}

      <Path d={area} fill={C.accent} opacity={0.1} />
      <Path
        d={d}
        fill="none"
        stroke={C.accent}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Exactly one direct label: a number on every point is chaos. It flips
          BELOW the dot when the line finishes near the top, so it never
          collides with the tier name in the right-hand gutter. */}
      <Circle cx={endX} cy={endY} r={4.5} fill={C.accent} stroke={C.page} strokeWidth={2} />
      <SvgText
        x={endX - 10}
        y={endY < padT + 26 ? endY + 17 : endY - 10}
        fill={C.ink}
        fontSize={11}
        fontFamily={FONT.bold}
        textAnchor="end"
      >
        {`${Math.round(points[points.length - 1].points)} pts`}
      </SvgText>

      {[
        { d: first, x: 0, anchor: "start" as const },
        { d: mid, x: plotW / 2, anchor: "middle" as const },
        { d: last, x: plotW, anchor: "end" as const },
      ].map((t, i) => (
        <SvgText
          key={i}
          x={t.x}
          y={height - 5}
          fill={C.inkFaint}
          fontSize={9}
          fontFamily={FONT.semibold}
          textAnchor={t.anchor}
        >
          {`${MONTHS[t.d.getMonth()]} ${String(t.d.getFullYear()).slice(2)}`}
        </SvgText>
      ))}
    </Svg>
  );
}

export interface DumbbellRow {
  label: string;
  from: number;
  to: number;
  isNew?: boolean;
}

export function Dumbbell({
  rows,
  width,
}: {
  rows: DumbbellRow[];
  /** Measured from the parent. The unit belongs in the section label, not
   *  on every row, a suffix per row is noise the axis already carries. */
  width: number;
}) {
  const ROW_H = 38;
  if (width <= 0 || rows.length === 0) return null;

  const padR = 52; // the delta labels live here
  const plotW = Math.max(1, width - padR);
  const lo = Math.min(...rows.map((r) => Math.min(r.from, r.to)));
  const hi = Math.max(...rows.map((r) => Math.max(r.from, r.to)));
  const span = Math.max(1, hi - lo);
  // 6% padding each side so an endpoint never sits exactly on the edge.
  const px = (v: number) => ((v - lo) / span) * plotW * 0.88 + plotW * 0.06;
  const height = rows.length * ROW_H + 6;

  return (
    <Svg width={width} height={height}>
      {rows.map((r, i) => {
        const y = 24 + i * ROW_H;
        const gain = r.to - r.from;
        const moved = gain > 0.5;
        const col = moved ? C.accent : C.inkFaint;
        // A brand-new lift still shows what it added since its debut; "new"
        // is only for a lift that appeared and has not moved since, where
        // there is no number worth printing.
        const label = moved ? `+${Math.round(gain)}` : r.isNew ? "new" : "-";
        return (
          <React.Fragment key={r.label}>
            <SvgText x={0} y={y - 10} fill={C.inkSoft} fontSize={11} fontFamily={FONT.semibold}>
              {r.label}
            </SvgText>
            <Line
              x1={px(r.from)}
              y1={y}
              x2={px(r.to)}
              y2={y}
              stroke={col}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.5}
            />
            {/* Hollow = then, filled = now. One hue, two treatments. */}
            <Circle cx={px(r.from)} cy={y} r={4.5} fill={C.page} stroke={C.inkFaint} strokeWidth={2} />
            <Circle cx={px(r.to)} cy={y} r={5} fill={col} stroke={C.page} strokeWidth={2} />
            <SvgText
              x={width}
              y={y + 4}
              fill={col}
              fontSize={11}
              fontFamily={FONT.bold}
              textAnchor="end"
            >
              {label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** A single ratio against a limit: a meter, never a two-slice donut. */
export function Meter({ value, color = C.accent }: { value: number; color?: string }) {
  return (
    <View
      style={{
        height: 6,
        borderRadius: 999,
        backgroundColor: C.page2,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height: "100%",
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Tiny caption used under the charts. */
export function ChartNote({ children }: { children: React.ReactNode }) {
  return (
    <Txt size={10.5} color={C.inkFaint} style={{ marginTop: 6 }}>
      {children}
    </Txt>
  );
}

export { TIER_NAMES };
