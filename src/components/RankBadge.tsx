/**
 * RankBadge — the react-native-svg port of the shield badge designed in
 * the lavish rounds (.lavish/torq-brand-v2.html): rounded hex shield in
 * the tier's metal gradient, the vortex brand mark as the emblem, and the
 * orbit ring that grows with the stage — I bare · II ring · III one jewel
 * ball · IV two balls. World Class swaps the metal for the holographic
 * gradient. Static render (no SMIL/filters in RN): jewel balls keep their
 * radial gradient + specular dot, the ring keeps the masked gap around
 * each ball; the animated comet trails stay a share-card/web thing.
 */
import { View } from "react-native";
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

export function RankBadge({ tier, stage = 4, size = 44 }: { tier: TierName; stage?: 1 | 2 | 3 | 4; size?: number }) {
  const m = METALS[tier];
  const cy = CY + 1;
  const front = ballPos(true, cy);
  const back = ballPos(false, cy);
  const showRing = stage >= 2;
  const showBall = stage >= 3;
  const showBall2 = stage >= 4;
  const uid = tier.replace(/\s/g, "");
  const frameId = `f${uid}`;
  const ballId = `b${uid}`;
  const maskId = `m${uid}${stage}`;

  return (
    <View style={{ width: size, height: (size * 136) / 170 }}>
      <Svg width={size} height={(size * 136) / 170} viewBox="0 0 170 136">
        <Defs>
          {m.holo ? (
            <LinearGradient id={frameId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7CF9D4" />
              <Stop offset="0.28" stopColor="#7FB2FF" />
              <Stop offset="0.55" stopColor="#C08CFF" />
              <Stop offset="0.78" stopColor="#FF7FB8" />
              <Stop offset="1" stopColor="#FFD97F" />
            </LinearGradient>
          ) : (
            <LinearGradient id={frameId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={m.light} />
              <Stop offset="1" stopColor={m.base} />
            </LinearGradient>
          )}
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

        {/* back half of the ring (darker metal) + back ball */}
        {showRing ? (
          <G mask={showBall ? `url(#${maskId})` : undefined}>
            <Path d={ellArc(Math.PI, 2 * Math.PI, cy)} fill="none" stroke={m.dark} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          </G>
        ) : null}
        {showBall2 ? (
          <G>
            <Circle cx={back.x} cy={back.y} r={4.8} fill={`url(#${ballId})`} />
            <Circle cx={back.x - 4.8 * 0.04} cy={back.y - 4.8 * 0.44} r={4.8 * 0.28} fill="#FAFDF3" opacity={0.92} />
          </G>
        ) : null}

        {/* shield: deep drop, dark field, metal frame */}
        <Polygon points={hexPoints(CX, cy + 4, R - SW / 2)} fill={m.deep} stroke={m.deep} strokeWidth={SW} strokeLinejoin="round" />
        <Polygon points={hexPoints(CX, CY, R - SW / 2)} fill={FIELD} stroke={FIELD} strokeWidth={SW} strokeLinejoin="round" />
        <Polygon points={hexPoints(CX, CY, R - 5)} fill="none" stroke={`url(#${frameId})`} strokeWidth={8} strokeLinejoin="round" />

        {/* vortex emblem, tier-light */}
        <G transform={`translate(${CX} ${cy}) scale(0.5) translate(-50 -51) scale(0.09765625) translate(0 1024) scale(0.1 -0.1)`}>
          <Path fill={m.light} d={VORTEX_PATH} />
        </G>

        {/* front half of the ring + front ball (jewel) */}
        {showRing ? (
          <G mask={showBall ? `url(#${maskId})` : undefined}>
            <Path d={ellArc(0, Math.PI, cy)} fill="none" stroke={m.base} strokeWidth={4} strokeLinecap="round" />
          </G>
        ) : null}
        {showBall ? (
          <G>
            <Circle cx={front.x} cy={front.y} r={6} fill={`url(#${ballId})`} />
            <Circle cx={front.x - 6 * 0.04} cy={front.y - 6 * 0.44} r={6 * 0.28} fill="#FAFDF3" opacity={0.92} />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
