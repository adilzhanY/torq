/**
 * RankBadge: the hex-track badge Adilzhan picked on 2026-09-04 from the
 * artifact "Torq Badge Ladder" (three concepts were drawn against it, Loaded
 * Bar / Momentum / Cut Stone, and this one won). It keeps what the earlier
 * shield had, the vortex emblem, the nine tier metals and the rounded
 * hexagon, and changes two things:
 *
 *  - STAGE is a TRACK, not an orbit. A thin hexagon outside the frame lights
 *    a quarter of its perimeter per stage, clockwise from the top, with one
 *    gem at the lit tip. Stage IV closes the loop and the gem sits at the
 *    crown. It follows the shield's own edges instead of tilting away from
 *    them, and it reads as a quantity ("three quarters there") at a glance.
 *  - TIER earns DETAIL, one thing per step, cumulative, driven by the
 *    `DETAIL` table below: Rust is matte and bare, Iron gets a bevel, Silver
 *    a gloss band, Gold corner studs, Platinum a halo, Diamond facets and
 *    glints, Elite eight rays behind the shield (one per blade of the
 *    vortex), World Class the holographic frame and a sheen. Each flag has a
 *    `minSize`, so a 34 px feed badge is frame + emblem + track + gem and
 *    the ornaments only appear where they are legible. Tuning a tier is a
 *    data edit, not a render edit.
 *
 * TWO RENDER PATHS, same split as before and for the same reason:
 *
 *  - STATIC (default): one SVG. List rows (Ranks, Friends, Profile, Home)
 *    draw many badges and none of them should pay for motion.
 *  - ANIMATED (`animated`): the hero badge and the tier ladder. The gem
 *    glides around the track, the rays turn, the glints twinkle, and World
 *    Class gets the sheen. Everything but the sheen runs on the NATIVE
 *    driver through sampled interpolation tables (the gem's path is the hex
 *    polyline sampled into lookup tables, exactly how the old ellipse orbit
 *    worked). The gem is always OUTSIDE the shield, so the old under/over
 *    double-draw and cross-fade are gone.
 *
 * The sheen is the one JS-driven animation: it is a band sliding under an
 * SVG mask, and a mask cannot be moved by a native transform, so the Rect's
 * `x` is animated as a prop. It runs on exactly one badge at a time (the
 * World Class hero), which is why that is acceptable.
 *
 * Geometry lives in a 200 x 160 viewBox, the same 0.8 aspect as the old
 * 170 x 136 one, so no caller's layout moved. `BADGE_ASPECT` is exported for
 * the one place that needs the number (TierCarousel's row height).
 */
import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { VORTEX_PATH } from "./Logo";
import { TIER_NAMES, type TierName } from "../lib/rank";

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

/** The holographic frame, World Class only. */
const HOLO = ["#7CF9D4", "#7FB2FF", "#C08CFF", "#FF7FB8", "#FFD97F"];

const LEVEL = Object.fromEntries(TIER_NAMES.map((t, i) => [t, i])) as Record<TierName, number>;

/**
 * What each tier earns, and the smallest badge it is drawn at. `from` is the
 * tier index (Rust 0 ... World Class 8); details are cumulative, so Diamond
 * has everything from `from <= 6`.
 */
const DETAIL = {
  bevel: { from: 1, minSize: 0 },
  gloss: { from: 3, minSize: 46 },
  studs: { from: 4, minSize: 46 },
  halo: { from: 5, minSize: 64 },
  facets: { from: 6, minSize: 46 },
  glints: { from: 6, minSize: 46 },
  rays: { from: 7, minSize: 64 },
  sheen: { from: 8, minSize: 104 },
} as const;
type Detail = keyof typeof DETAIL;

function has(tier: TierName, size: number, d: Detail): boolean {
  return LEVEL[tier] >= DETAIL[d].from && size >= DETAIL[d].minSize;
}

// ── geometry (viewBox units) ─────────────────────────────────────────────
const VB_W = 200;
const VB_H = 160;
export const BADGE_ASPECT = VB_H / VB_W;
const CX = 100;
const CY = 80;
/** Frame hexagon, vertex radius. */
const R = 50;
/** Frame stroke. */
const SW = 12;
const TRACK_R = R + 13;
const HALO_R = R + 21;
const GEM_R = 5.6;
/** Emblem width across the vortex's 1024 box. 72/50 = 1.44 x R: Adilzhan
 * first asked for a touch smaller than the artifact (1.32), then for bigger
 * once he saw it on the phone, so it now fills the field. The vortex's own
 * silhouette is ~60% of its box, so it still clears the inner frame. */
const EMBLEM_W = 72;
/**
 * The one row size. Home's rank row, Profile's rank strip and best lifts,
 * and the Ranks lift rows all use it, so the badge never looks bigger on one
 * page than another (Adilzhan, 2026-09-04: it read as small and inconsistent
 * at 46 / 62 / 64 / 68). 96 is 1.5 x the old Profile strip.
 */
export const BADGE_ROW = 96;
const FIELD = "#131510";
/** One lap of the track, in ms. A drift, not a spin. */
const LAP_MS = 7000;
const RAY_MS = 26000;
const TWINKLE_MS = 1300;
const SHEEN_MS = 4500;
/** Samples along the track for the gem's lookup tables. */
const STEPS = 60;

type Pt = [number, number];

/** Pointy-top hexagon, first vertex at the top, clockwise on screen. */
function hexPts(cx: number, cy: number, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
const attr = (pts: Pt[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const pathOf = (pts: Pt[]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";

/** Point at fraction `f` (0..1) of the hex perimeter, clockwise from the top. */
function alongHex(pts: Pt[], f: number): Pt {
  const d = (((f % 1) + 1) % 1) * 6;
  const i = Math.min(5, Math.floor(d));
  const t = d - i;
  const a = pts[i];
  const b = pts[(i + 1) % 6];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The track polyline, sampled into native-drivable lookup tables. */
function trackTables(pts: Pt[]) {
  const input: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS;
    const [px, py] = alongHex(pts, p);
    input.push(p);
    x.push(px);
    y.push(py);
  }
  return { input, x, y };
}

/** Four-point star, the glint. */
function starPath(x: number, y: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  return `M${f(x)} ${f(y - r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)} Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)} Z`;
}

const FRAME = hexPts(CX, CY, R);
const TRACK = hexPts(CX, CY, TRACK_R);
const HALO = hexPts(CX, CY, HALO_R);
const TRACK_LEN = 6 * TRACK_R;
/** Glint anchors: the upper-right and lower-left corners of the frame. */
const GLINT_A: Pt = [FRAME[1][0] + 2, FRAME[1][1] - 8];
const GLINT_B: Pt = [FRAME[4][0] - 3, FRAME[4][1] + 7];

// ── shared pieces ────────────────────────────────────────────────────────

function frameGradient(m: Metal, id: string) {
  return m.holo ? (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {HOLO.map((c, i) => (
        <Stop key={c} offset={i / (HOLO.length - 1)} stopColor={c} />
      ))}
    </LinearGradient>
  ) : (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={m.light} />
      <Stop offset="1" stopColor={m.base} />
    </LinearGradient>
  );
}

function gemGradient(m: Metal, id: string) {
  return (
    <RadialGradient id={id} cx="0.36" cy="0.28" r="0.95">
      <Stop offset="0" stopColor={m.light} />
      <Stop offset="0.45" stopColor={m.base} />
      <Stop offset="0.82" stopColor={m.dark} />
      <Stop offset="1" stopColor={m.deep} />
    </RadialGradient>
  );
}

/** Eight blades and a soft glow behind the shield (Elite and up). */
function Rays({ m, frameId, glowId }: { m: Metal; frameId: string; glowId: string }) {
  const blades = [];
  for (let i = 0; i < 8; i++) {
    blades.push(
      <Path
        key={i}
        transform={`rotate(${i * 45} ${CX} ${CY})`}
        d={`M${CX} ${CY - 60} L${CX + 4.5} ${CY - 27} L${CX - 4.5} ${CY - 27} Z`}
        fill={m.holo ? `url(#${frameId})` : m.light}
        opacity={m.holo ? 0.55 : 0.32}
      />,
    );
  }
  return (
    <>
      <Circle cx={CX} cy={CY} r={78} fill={`url(#${glowId})`} />
      {blades}
    </>
  );
}

/**
 * The shield: drop, field, frame, and every frame detail the tier has
 * earned at this size. Shared by both render paths.
 */
function Shield({
  tier,
  size,
  m,
  frameId,
  glossId,
  sheenId,
  sheenRect,
}: {
  tier: TierName;
  size: number;
  m: Metal;
  frameId: string;
  glossId: string;
  sheenId: string;
  /** The animated sheen band, rendered under the frame mask when present. */
  sheenRect?: ReactNode;
}) {
  const facetPts = hexPts(CX, CY, R - 5.5);
  const shades = [m.light, m.base, m.dark, m.deep, m.dark, m.light];
  const gloss = has(tier, size, "gloss");
  return (
    <>
      <Polygon
        points={attr(hexPts(CX, CY + 4, R - SW / 2))}
        fill={m.deep}
        stroke={m.deep}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Polygon
        points={attr(hexPts(CX, CY, R - SW / 2))}
        fill={FIELD}
        stroke={FIELD}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Polygon
        points={attr(facetPts)}
        fill="none"
        stroke={`url(#${frameId})`}
        strokeWidth={SW - 3}
        strokeLinejoin="round"
      />
      {has(tier, size, "facets")
        ? facetPts.map((a, i) => {
            const b = facetPts[(i + 1) % 6];
            return (
              <Line
                key={i}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={shades[i]}
                strokeWidth={SW - 3}
                strokeLinecap="round"
                opacity={m.holo ? 0.28 : 0.55}
              />
            );
          })
        : null}
      {has(tier, size, "bevel") ? (
        <>
          <Polygon
            points={attr(hexPts(CX, CY, R - SW + 2.5))}
            fill="none"
            stroke={m.deep}
            strokeWidth={1.3}
            strokeLinejoin="round"
            opacity={0.9}
          />
          <Polygon
            points={attr(hexPts(CX, CY, R + 0.5))}
            fill="none"
            stroke={m.light}
            strokeWidth={0.9}
            strokeLinejoin="round"
            opacity={0.5}
          />
        </>
      ) : null}
      {gloss || sheenRect ? (
        <G mask={`url(#${sheenId})`}>
          <G transform={`rotate(-28 ${CX} ${CY})`}>
            {sheenRect ?? (
              <Rect x={40} y={-60} width={120} height={280} fill={`url(#${glossId})`} opacity={0.45} />
            )}
          </G>
        </G>
      ) : null}
      {has(tier, size, "studs")
        ? FRAME.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={2.6} fill={m.light} stroke={m.deep} strokeWidth={0.9} />
          ))
        : null}
      <G
        transform={`translate(${CX} ${CY + 1}) scale(${(EMBLEM_W / 1024).toFixed(5)}) translate(-512 -512) translate(0 1024) scale(0.1 -0.1)`}
      >
        <Path fill={m.light} d={VORTEX_PATH} />
      </G>
    </>
  );
}

/** Track base, lit fraction, halo. The gem is drawn by the caller. */
function Track({ tier, size, stage, m, frameId }: { tier: TierName; size: number; stage: number; m: Metal; frameId: string }) {
  const lit = TRACK_LEN * (stage / 4);
  return (
    <>
      {has(tier, size, "halo") ? (
        <Polygon
          points={attr(HALO)}
          fill="none"
          stroke={m.holo ? `url(#${frameId})` : m.base}
          strokeWidth={1.1}
          strokeLinejoin="round"
          opacity={m.holo ? 0.7 : 0.45}
        />
      ) : null}
      <Polygon points={attr(TRACK)} fill="none" stroke={m.deep} strokeWidth={2.8} strokeLinejoin="round" opacity={0.75} />
      <Path
        d={pathOf(TRACK)}
        fill="none"
        stroke={m.holo ? `url(#${frameId})` : m.base}
        strokeWidth={2.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={[lit, TRACK_LEN]}
      />
    </>
  );
}

function Gem({ x, y, gemId, m }: { x: number; y: number; gemId: string; m: Metal }) {
  return (
    <>
      <Circle cx={x} cy={y} r={GEM_R} fill={`url(#${gemId})`} stroke={m.deep} strokeWidth={0.9} />
      <Circle cx={x - GEM_R * 0.25} cy={y - GEM_R * 0.42} r={GEM_R * 0.32} fill="#FAFDF3" opacity={0.92} />
    </>
  );
}

function SharedDefs({ m, ids }: { m: Metal; ids: Ids }) {
  return (
    <Defs>
      {frameGradient(m, ids.frame)}
      {gemGradient(m, ids.gem)}
      <RadialGradient id={ids.glow}>
        <Stop offset="0" stopColor={m.base} stopOpacity={0.35} />
        <Stop offset="0.6" stopColor={m.base} stopOpacity={0.08} />
        <Stop offset="1" stopColor={m.base} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={ids.gloss} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </LinearGradient>
      {/* The frame ring as a mask: gloss and sheen only exist on the metal. */}
      <Mask id={ids.sheen} maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
        <Polygon
          points={attr(hexPts(CX, CY, R - 5.5))}
          fill="none"
          stroke="#fff"
          strokeWidth={SW - 3}
          strokeLinejoin="round"
        />
      </Mask>
    </Defs>
  );
}

type Ids = { frame: string; gem: string; glow: string; gloss: string; sheen: string };

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** A glint as a native-driven view so it can twinkle without touching SVG props. */
function Glint({
  at,
  k,
  r,
  t,
  invert,
}: {
  at: Pt;
  k: number;
  r: number;
  t: Animated.Value;
  /** The second glint runs half a cycle behind the first. */
  invert: boolean;
}) {
  const d = r * 2 * k;
  const range = invert ? [1, 0.2] : [0.2, 1];
  const scaleRange = invert ? [1, 0.6] : [0.6, 1];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: at[0] * k - d / 2,
        top: at[1] * k - d / 2,
        width: d,
        height: d,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: range }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: scaleRange }) }],
      }}
    >
      <Svg width={d} height={d} viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`}>
        <Path d={starPath(0, 0, r)} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

function RankBadgeImpl({
  tier,
  stage = 4,
  size = 44,
  animated = true,
}: {
  tier: TierName;
  stage?: 1 | 2 | 3 | 4;
  size?: number;
  /** Move the gem, rays and glints. ON by default since 2026-09-04 (Adilzhan
   * wanted the badge alive everywhere, not only on the Ranks hero). Every
   * loop is native-driven, so a screen of them costs the UI thread nothing;
   * pass false for a badge that is about to be captured as an image. */
  animated?: boolean;
}) {
  const m = METALS[tier];
  const height = size * BADGE_ASPECT;
  const uid = `${tier.replace(/\s/g, "")}${stage}${animated ? "a" : "s"}`;
  const ids: Ids = useMemo(
    () => ({ frame: `f${uid}`, gem: `g${uid}`, glow: `w${uid}`, gloss: `l${uid}`, sheen: `k${uid}` }),
    [uid],
  );
  const rays = has(tier, size, "rays");
  const glints = has(tier, size, "glints");
  const sheen = animated && has(tier, size, "sheen");

  const lap = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const tables = useMemo(() => trackTables(TRACK), []);

  useEffect(() => {
    if (!animated) return;
    lap.setValue(0);
    const loops = [
      Animated.loop(Animated.timing(lap, { toValue: 1, duration: LAP_MS, easing: Easing.linear, useNativeDriver: true })),
    ];
    if (rays) {
      loops.push(
        Animated.loop(Animated.timing(turn, { toValue: 1, duration: RAY_MS, easing: Easing.linear, useNativeDriver: true })),
      );
    }
    if (glints) {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(twinkle, { toValue: 1, duration: TWINKLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(twinkle, { toValue: 0, duration: TWINKLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      );
    }
    if (sheen) {
      // JS-driven on purpose: an SVG prop under a mask. One badge at a time.
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(slide, { toValue: 1, duration: SHEEN_MS * 0.6, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.delay(SHEEN_MS * 0.4),
          ]),
        ),
      );
    }
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [animated, rays, glints, sheen, lap, turn, twinkle, slide]);

  // ── animated path ───────────────────────────────────────────────────────
  if (animated) {
    const k = size / VB_W;
    const gd = GEM_R * 2 * k;
    const layer = { position: "absolute" as const, left: 0, top: 0 };
    return (
      <View style={{ width: size, height }}>
        {rays ? (
          <Animated.View
            pointerEvents="none"
            style={[
              layer,
              {
                width: size,
                height,
                transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
              },
            ]}
          >
            <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <Defs>
                {frameGradient(m, `${ids.frame}r`)}
                <RadialGradient id={`${ids.glow}r`}>
                  <Stop offset="0" stopColor={m.base} stopOpacity={0.35} />
                  <Stop offset="0.6" stopColor={m.base} stopOpacity={0.08} />
                  <Stop offset="1" stopColor={m.base} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rays m={m} frameId={`${ids.frame}r`} glowId={`${ids.glow}r`} />
            </Svg>
          </Animated.View>
        ) : null}

        <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={layer}>
          <SharedDefs m={m} ids={ids} />
          <Track tier={tier} size={size} stage={stage} m={m} frameId={ids.frame} />
          <Shield
            tier={tier}
            size={size}
            m={m}
            frameId={ids.frame}
            glossId={ids.gloss}
            sheenId={ids.sheen}
            sheenRect={
              sheen ? (
                <AnimatedRect
                  x={slide.interpolate({ inputRange: [0, 1], outputRange: [-140, 180] })}
                  y={-60}
                  width={120}
                  height={280}
                  fill={`url(#${ids.gloss})`}
                  opacity={0.75}
                />
              ) : undefined
            }
          />
        </Svg>

        {/* The gem, gliding around the track on the native driver. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: gd,
            height: gd,
            transform: [
              { translateX: lap.interpolate({ inputRange: tables.input, outputRange: tables.x.map((v) => v * k - gd / 2) }) },
              { translateY: lap.interpolate({ inputRange: tables.input, outputRange: tables.y.map((v) => v * k - gd / 2) }) },
            ],
          }}
        >
          <Svg width={gd} height={gd} viewBox={`${-GEM_R - 1} ${-GEM_R - 1} ${2 * GEM_R + 2} ${2 * GEM_R + 2}`}>
            <Defs>{gemGradient(m, `${ids.gem}m`)}</Defs>
            <Gem x={0} y={0} gemId={`${ids.gem}m`} m={m} />
          </Svg>
        </Animated.View>

        {glints ? (
          <>
            <Glint at={GLINT_A} k={k} r={6.5} t={twinkle} invert={false} />
            <Glint at={GLINT_B} k={k} r={4.8} t={twinkle} invert />
          </>
        ) : null}
      </View>
    );
  }

  // ── static path ─────────────────────────────────────────────────────────
  const tip = alongHex(TRACK, (stage / 4) % 1);
  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <SharedDefs m={m} ids={ids} />
        {rays ? <Rays m={m} frameId={ids.frame} glowId={ids.glow} /> : null}
        <Track tier={tier} size={size} stage={stage} m={m} frameId={ids.frame} />
        <Gem x={tip[0]} y={tip[1]} gemId={ids.gem} m={m} />
        <Shield tier={tier} size={size} m={m} frameId={ids.frame} glossId={ids.gloss} sheenId={ids.sheen} />
        {glints ? (
          <>
            <Path d={starPath(GLINT_A[0], GLINT_A[1], 6.5)} fill="#FFFFFF" opacity={0.9} />
            <Path d={starPath(GLINT_B[0], GLINT_B[1], 4.8)} fill="#FFFFFF" opacity={0.6} />
          </>
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
