/**
 * RankBadge — the react-native-svg port of the shield badge designed in
 * the lavish rounds (.lavish/torq-brand-v2.html): rounded hex shield in
 * the tier's metal gradient, the vortex brand mark as the emblem, and the
 * orbit ring that grows with the stage — I bare · II ring · III one jewel
 * ball · IV two balls. World Class swaps the metal for the holographic
 * gradient.
 *
 * TWO RENDER PATHS, and the split is deliberate:
 *
 *  - STATIC (default) — one SVG, balls parked at the ellipse's ends, the
 *    ring masked so it breaks around each ball. This is what list rows use:
 *    a Ranks screen with 8 lifts, a Friends list and Home all draw badges,
 *    and none of them should pay for an animation nobody is looking at.
 *
 *  - ANIMATED (`animated`) — the balls actually ORBIT, on every tier
 *    (Adilzhan, 2026-08-09: the motion should not be a World Class
 *    privilege). Used on the big hero badge and the tier ladder.
 *
 * How the orbit is done, since RN has no SMIL: one looping Animated.Value
 * drives translateX/translateY/scale/opacity through sampled interpolation
 * tables of the tilted ellipse, all on the NATIVE driver — so the motion
 * never touches the JS thread while you scroll. Z-ORDER is faked by drawing
 * each ball TWICE, once under the shield and once over it, and cross-fading
 * between the copies; the swap happens at the ellipse's left and right
 * extremes, where the ball is clear of the shield silhouette and the change
 * is invisible. The balls are plain Views rather than SVG circles: at 12 px
 * across, a fill plus a specular dot is indistinguishable from the gradient
 * and costs a fraction of the nodes.
 *
 * The animated path drops the ring's mask gap on purpose — an opaque ball
 * riding over a continuous ring reads as "in front" by itself, and a moving
 * gap would need animated SVG props, which are JS-driven.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { VORTEX_PATH } from "./Logo";
import type { TierName } from "../lib/rank";

type Metal = { base: string; light: string; dark: string; deep: string; holo?: boolean };

const METALS: Record<TierName, Metal> = {
  Rust: { base: "#A05A32", light: "#C77E4F", dark: "#7A4020", deep: "#4E2A14" },
  Iron: { base: "#9AA3AE", light: "#C3CBD4", dark: "#6E7681", deep: "#454B53" },
  Bronze: { base: "#C97E35", light: "#E8A55B", dark: "#96591F", deep: "#5E3812" },
  Silver: { base: "#C9D2DA", light: "#EDF2F7", dark: "#97A2AD", deep: "#616B75" },
  Gold: { base: "#E9B920", light: "#FFDF5E", dark: "#B08812", deep: "#6E550A" },
  Platinum: { base: "#A8D8DC", light: "#DFF6F8", dark: "#74A6AB", deep: "#486D71" },
  Diamond: { base: "#6FA9E8", light: "#A9D4FF", dark: "#4678B8", deep: "#2B4C78" },
  Elite: { base: "#A8D51C", light: "#C8FE23", dark: "#79A010", deep: "#4C6608" },
  "World Class": { base: "#9C86E8", light: "#F4EFFF", dark: "#6E58B8", deep: "#443578", holo: true },
};

// Geometry (identical to the web generator).
const CX = 85;
const CY = 62;
const R = 37;
const SW = 12;
const TILT = -13;
const ORX = R + 21;
const ORY = 16;
const GAP = 3.6;
const FIELD = "#131510";
const D2R = Math.PI / 180;
const VB_W = 170;
const VB_H = 136;
/** Ball radius in viewBox units. */
const BALL_R = 6;
/** One full orbit, in ms. Slow enough to read as a drift, not a spin. */
const ORBIT_MS = 7000;
/** Ellipse samples for the interpolation tables. */
const STEPS = 48;

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Half of the tilted orbit ellipse as a sampled polyline path. */
function ellArc(a0: number, a1: number, cy: number): string {
  const rot = TILT * D2R;
  const pts: string[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = a0 + ((a1 - a0) * i) / 26;
    const x = ORX * Math.cos(t);
    const y = ORY * Math.sin(t);
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    pts.push(`${(CX + xr).toFixed(1)} ${(cy + yr).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

/** Static ball positions: front ball on the right end, back ball opposite. */
function ballPos(front: boolean, cy: number): { x: number; y: number } {
  const a = TILT * D2R;
  const sign = front ? 1 : -1;
  return { x: CX + sign * ORX * Math.cos(a), y: cy + sign * ORY * 0 + sign * ORX * Math.sin(a) };
}

/** The tilted ellipse, sampled once into native-drivable lookup tables. */
function orbitTables(cy: number) {
  const rot = TILT * D2R;
  const input: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const front: number[] = [];
  const scale: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS;
    const t = p * Math.PI * 2;
    const ex = ORX * Math.cos(t);
    const ey = ORY * Math.sin(t);
    input.push(p);
    x.push(CX + ex * Math.cos(rot) - ey * Math.sin(rot));
    y.push(cy + ex * Math.sin(rot) + ey * Math.cos(rot));
    // SVG y grows downward, so the lower half of the ellipse is the near
    // half: that is when the ball passes IN FRONT of the shield.
    front.push(Math.sin(t) >= 0 ? 1 : 0);
    // A touch of perspective — smaller when it is further away.
    scale.push(0.8 + 0.2 * ((Math.sin(t) + 1) / 2));
  }
  return { input, x, y, front, scale };
}

/** The shield itself, shared by both render paths. */
function shieldParts(m: Metal, frameId: string, cy: number) {
  return (
    <>
      <Polygon
        points={hexPoints(CX, cy + 4, R - SW / 2)}
        fill={m.deep}
        stroke={m.deep}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Polygon
        points={hexPoints(CX, CY, R - SW / 2)}
        fill={FIELD}
        stroke={FIELD}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Polygon
        points={hexPoints(CX, CY, R - 5)}
        fill="none"
        stroke={`url(#${frameId})`}
        strokeWidth={8}
        strokeLinejoin="round"
      />
      <G
        transform={`translate(${CX} ${cy}) scale(0.5) translate(-50 -51) scale(0.09765625) translate(0 1024) scale(0.1 -0.1)`}
      >
        <Path fill={m.light} d={VORTEX_PATH} />
      </G>
    </>
  );
}

function frameGradient(m: Metal, id: string) {
  return m.holo ? (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#7CF9D4" />
      <Stop offset="0.28" stopColor="#7FB2FF" />
      <Stop offset="0.55" stopColor="#C08CFF" />
      <Stop offset="0.78" stopColor="#FF7FB8" />
      <Stop offset="1" stopColor="#FFD97F" />
    </LinearGradient>
  ) : (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={m.light} />
      <Stop offset="1" stopColor={m.base} />
    </LinearGradient>
  );
}

/**
 * One orbiting ball: a plain View, positioned by the native driver. Two of
 * these exist per ball (an under-shield copy and an over-shield copy); each
 * is only visible on the half of the orbit it belongs to.
 */
function OrbitBall({
  m,
  t,
  phase,
  layer,
  tables,
  k,
}: {
  m: Metal;
  t: Animated.Value;
  /** 0 or 0.5 — the second ball rides opposite the first. */
  phase: number;
  layer: "front" | "back";
  tables: ReturnType<typeof orbitTables>;
  /** viewBox units → pixels. */
  k: number;
}) {
  const d = BALL_R * 2 * k;
  // Shift the lookup so the ball starts half an orbit later.
  const shifted = (arr: number[]) => {
    const off = Math.round(phase * STEPS);
    const out = arr.slice(off).concat(arr.slice(1, off + 1));
    return out;
  };
  const xs = shifted(tables.x).map((v) => v * k - d / 2);
  const ys = shifted(tables.y).map((v) => v * k - d / 2);
  const fronts = shifted(tables.front).map((v) => (layer === "front" ? v : 1 - v));
  const scales = shifted(tables.scale);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: m.base,
        borderWidth: Math.max(0.5, d * 0.06),
        borderColor: m.deep,
        opacity: t.interpolate({ inputRange: tables.input, outputRange: fronts }),
        transform: [
          { translateX: t.interpolate({ inputRange: tables.input, outputRange: xs }) },
          { translateY: t.interpolate({ inputRange: tables.input, outputRange: ys }) },
          { scale: t.interpolate({ inputRange: tables.input, outputRange: scales }) },
        ],
      }}
    >
      {/* Specular highlight — what sells it as a sphere at 12 px. */}
      <View
        style={{
          position: "absolute",
          left: d * 0.2,
          top: d * 0.14,
          width: d * 0.34,
          height: d * 0.34,
          borderRadius: d * 0.17,
          backgroundColor: "#FAFDF3",
          opacity: 0.92,
        }}
      />
    </Animated.View>
  );
}

function RankBadgeImpl({
  tier,
  stage = 4,
  size = 44,
  animated = false,
}: {
  tier: TierName;
  stage?: 1 | 2 | 3 | 4;
  size?: number;
  /** Orbit the balls. Off by default — list rows should not pay for it. */
  animated?: boolean;
}) {
  const m = METALS[tier];
  const cy = CY + 1;
  const height = (size * VB_H) / VB_W;
  const showRing = stage >= 2;
  const showBall = stage >= 3;
  const showBall2 = stage >= 4;
  const uid = `${tier.replace(/\s/g, "")}${stage}${animated ? "a" : "s"}`;
  const frameId = `f${uid}`;
  const ballId = `b${uid}`;
  const maskId = `m${uid}`;

  const t = useRef(new Animated.Value(0)).current;
  const tables = useMemo(() => orbitTables(cy), [cy]);

  useEffect(() => {
    if (!animated || !showBall) return;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: ORBIT_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, showBall, t]);

  // ── animated path ───────────────────────────────────────────────────────
  if (animated && showBall) {
    const k = size / VB_W;
    return (
      <View style={{ width: size, height, justifyContent: "center" }}>
        {/* under the shield */}
        <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: "absolute" }}>
          <Path
            d={ellArc(Math.PI, 2 * Math.PI, cy)}
            fill="none"
            stroke={m.dark}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.9}
          />
        </Svg>
        <OrbitBall m={m} t={t} phase={0} layer="back" tables={tables} k={k} />
        {showBall2 ? (
          <OrbitBall m={m} t={t} phase={0.5} layer="back" tables={tables} k={k} />
        ) : null}

        {/* the shield, and the near half of the ring */}
        <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: "absolute" }}>
          <Defs>{frameGradient(m, frameId)}</Defs>
          {shieldParts(m, frameId, cy)}
          <Path
            d={ellArc(0, Math.PI, cy)}
            fill="none"
            stroke={m.base}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </Svg>

        {/* over the shield */}
        <OrbitBall m={m} t={t} phase={0} layer="front" tables={tables} k={k} />
        {showBall2 ? (
          <OrbitBall m={m} t={t} phase={0.5} layer="front" tables={tables} k={k} />
        ) : null}
      </View>
    );
  }

  // ── static path (unchanged) ─────────────────────────────────────────────
  const front = ballPos(true, cy);
  const back = ballPos(false, cy);

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          {frameGradient(m, frameId)}
          <RadialGradient id={ballId} cx="0.36" cy="0.28" r="0.95">
            <Stop offset="0" stopColor={m.light} />
            <Stop offset="0.45" stopColor={m.base} />
            <Stop offset="0.82" stopColor={m.dark} />
            <Stop offset="1" stopColor={m.deep} />
          </RadialGradient>
          {showBall ? (
            <Mask id={maskId} maskUnits="userSpaceOnUse" x="-20" y="-20" width="210" height="176">
              <Rect x="-20" y="-20" width="210" height="176" fill="#fff" />
              <Circle cx={front.x} cy={front.y} r={6 + GAP} fill="#000" />
              {showBall2 ? <Circle cx={back.x} cy={back.y} r={4.8 + GAP} fill="#000" /> : null}
            </Mask>
          ) : null}
        </Defs>

        {showRing ? (
          <G mask={showBall ? `url(#${maskId})` : undefined}>
            <Path
              d={ellArc(Math.PI, 2 * Math.PI, cy)}
              fill="none"
              stroke={m.dark}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.9}
            />
          </G>
        ) : null}
        {showBall2 ? (
          <G>
            <Circle cx={back.x} cy={back.y} r={4.8} fill={`url(#${ballId})`} />
            <Circle
              cx={back.x - 4.8 * 0.04}
              cy={back.y - 4.8 * 0.44}
              r={4.8 * 0.28}
              fill="#FAFDF3"
              opacity={0.92}
            />
          </G>
        ) : null}

        {shieldParts(m, frameId, cy)}

        {showRing ? (
          <G mask={showBall ? `url(#${maskId})` : undefined}>
            <Path
              d={ellArc(0, Math.PI, cy)}
              fill="none"
              stroke={m.base}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </G>
        ) : null}
        {showBall ? (
          <G>
            <Circle cx={front.x} cy={front.y} r={6} fill={`url(#${ballId})`} />
            <Circle
              cx={front.x - 6 * 0.04}
              cy={front.y - 6 * 0.44}
              r={6 * 0.28}
              fill="#FAFDF3"
              opacity={0.92}
            />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * The vortex emblem is a 2 500-character traced path and the Ranks screen
 * mounts about seventeen of these at once (nine in the ladder, one per
 * lift). Memoising keeps a parent re-render from re-diffing all of them.
 */
export const RankBadge = memo(RankBadgeImpl);
