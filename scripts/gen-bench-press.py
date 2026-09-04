#!/usr/bin/env python3
"""Generate assets/BenchPress.json: a flat-style bench press animation in the
language of the reference pack (see assets/Squat Reach.json). From the root:

    ./scripts/gen-bench-press.py

WHAT WAS COPIED FROM THE REFERENCE, decoded rather than guessed:
  - 720x720 at 30 fps on a white solid, flat fills, NO strokes.
  - The exact palette: skin #DAB194 with lighter #E6BDA1 lower arms, shirt
    #D66228 with white trim, shorts #232323, shoes #3A3C3B + #E26927 accent,
    hair #5E3C22.
  - Limbs are capsules with rounded ends that overlap at the joints, which
    is what lets rotation joints read as knees and elbows without any
    explicit joint art.
  - Holds at the extremes and ease-in-out motion. Their house easing is
    o=(0.333,0) -> i=(0.667,1) on sparse hand-set keys.

WHAT IS DIFFERENT, and why:
  - The arm chain is solved with two-bone IK per sampled frame and BAKED as
    world-space keys every 2 frames. The reference parents leg chains from
    the planted foot upward, which is their manual IK trick; a bench press
    has the opposite constraint (hands welded to a moving bar, shoulders
    welded to the torso), and only an exact solve keeps the hands on the bar
    through the whole stroke. Dense samples of an eased profile are
    indistinguishable from hand easing, and the wrists never drift.
  - The far limbs are darkened ~12%: bench press arms travel parallel and
    overlap, and without a value split the two arms merge into one blob.

MOTION NOTES (the physics the animation encodes):
  - Descent is controlled and slower than the press: 32 frames down against
    28 up at 30 fps.
  - The bar path is a slight "J": over the shoulders at lockout, over the
    lower chest at the touch.
  - The press has a STICKING POINT: fast drive off the chest, a visible
    deceleration around 60% of the way up, then through to lockout with a
    2 px overshoot and settle.
  - The torso arches slightly against the effort while pressing; the far
    arm trails the near arm by one frame for follow-through.
"""
import json
import math
import pathlib

W = H = 720
FPS = 30
LOOP = 96                      # frames; frame 96 == frame 0

# ---------------------------------------------------------------- palette --
SKIN = "#DAB194"
SKIN_LO = "#E6BDA1"            # lower arms, like the reference
SHIRT = "#D66228"
TRIM = "#FFFFFF"
SHORTS = "#232323"
SHOE = "#3A3C3B"
SHOE_DARK = "#212121"
ACCENT = "#E26927"
HAIR = "#5E3C22"
PLATE = "#232323"
PLATE_RING = "#3A3C3B"
BAR_METAL = "#8A8A8A"

def dim(hexc, f=0.86):
    """The far-limb shade: the same hue, ~12% darker."""
    return "#" + "".join(f"{round(int(hexc[i:i+2], 16) * f):02X}" for i in (1, 3, 5))

# --------------------------------------------------------------- skeleton --
# Head LEFT, feet RIGHT. y grows downward. The floor is y=560.
BENCH_TOP = 468
SHOULDER = (272.0, 438.0)
L1, L2 = 74.0, 72.0            # upper arm, forearm
FAR_OFF = (-9.0, -7.0)         # the far side sits up-left a touch
BAR_TOP = (276.0, 296.0)       # lockout: nearly straight arms, soft elbow
BAR_BOT = (318.0, 414.0)       # touch: over the lower chest
HIP = (447.0, 455.0)
KNEE = (549.0, 462.0)
ANKLE = (556.0, 538.0)

# ------------------------------------------------------------------ paths --
K = 0.5523                     # circle-as-bezier constant

def circle(cx, cy, r):
    k = K * r
    return {"c": True,
            "v": [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]],
            "i": [[-k, 0], [0, -k], [k, 0], [0, k]],
            "o": [[k, 0], [0, k], [-k, 0], [0, -k]]}

def capsule(x0, y0, x1, y1, r):
    """A rounded bar from (x0,y0) to (x1,y1): the reference's limb shape."""
    dx, dy = x1 - x0, y1 - y0
    d = math.hypot(dx, dy) or 1.0
    ux, uy = dx / d, dy / d          # along the bone
    px, py = -uy, ux                 # perpendicular
    k = K * r
    v = [[x0 + px * r, y0 + py * r], [x0 - ux * r, y0 - uy * r],
         [x0 - px * r, y0 - py * r], [x1 - px * r, y1 - py * r],
         [x1 + ux * r, y1 + uy * r], [x1 + px * r, y1 + py * r]]
    i = [[ux * k, uy * k], [px * k, py * k], [-px * k, -py * k],
         [0, 0], [-px * k, -py * k], [px * k, py * k]]
    o = [[-ux * k, -uy * k], [-px * k, -py * k], [px * k, py * k],
         [-px * k, -py * k], [px * k, py * k], [0, 0]]
    return {"c": True, "v": v, "i": i, "o": o}

def rrect(x0, y0, x1, y1, r):
    k = K * r
    return {"c": True,
            "v": [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r],
                  [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]],
            "i": [[0, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]],
            "o": [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]]}

def wedge(pts):
    return {"c": True, "v": pts, "i": [[0, 0]] * len(pts), "o": [[0, 0]] * len(pts)}

# ------------------------------------------------------- lottie scaffolds --
def r2(x):
    return round(x, 2)

def clean(o):
    if isinstance(o, float):
        return r2(o)
    if isinstance(o, list):
        return [clean(v) for v in o]
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    return o

def hex_fill(hexc):
    c = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return {"ty": "fl", "c": {"a": 0, "k": [r2(v) for v in c] + [1]}, "o": {"a": 0, "k": 100}}

def shape(path, fill):
    return {"ty": "gr", "it": [
        {"ty": "sh", "ks": {"a": 0, "k": path}},
        hex_fill(fill),
        {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
         "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0},
         "o": {"a": 0, "k": 100}}]}

def static(v):
    return {"a": 0, "k": v}

EASE_OUT = {"x": [0.333], "y": [0]}
EASE_IN = {"x": [0.667], "y": [1]}
LIN_OUT = {"x": [0.167], "y": [0.167]}
LIN_IN = {"x": [0.833], "y": [0.833]}

def keyframes(keys, spatial=False):
    """keys: [(t, value, dense)] -> a Lottie animated property. Dense keys get
    linear easing (the curve already lives in the sample spacing); sparse keys
    get the reference's house easing."""
    out = []
    for i, (t, v, dense) in enumerate(keys):
        kf = {"t": t, "s": [v] if not isinstance(v, list) else v}
        if i < len(keys) - 1:
            if dense:
                kf["o"] = {"x": LIN_OUT["x"] if not spatial else LIN_OUT["x"][0],
                           "y": LIN_OUT["y"] if not spatial else LIN_OUT["y"][0]}
                kf["i"] = {"x": LIN_IN["x"] if not spatial else LIN_IN["x"][0],
                           "y": LIN_IN["y"] if not spatial else LIN_IN["y"][0]}
            else:
                kf["o"] = {"x": EASE_OUT["x"] if not spatial else EASE_OUT["x"][0],
                           "y": EASE_OUT["y"] if not spatial else EASE_OUT["y"][0]}
                kf["i"] = {"x": EASE_IN["x"] if not spatial else EASE_IN["x"][0],
                           "y": EASE_IN["y"] if not spatial else EASE_IN["y"][0]}
            if spatial:
                kf["to"] = [0, 0]
                kf["ti"] = [0, 0]
        out.append(kf)
    return {"a": 1, "k": out}

def layer(ind, name, shapes, p=None, a=None, r=None):
    return {"ddd": 0, "ind": ind, "ty": 4, "nm": name, "sr": 1,
            "ks": {"o": static(100),
                   "r": r if r else static(0),
                   "p": p if p else static([0, 0, 0]),
                   "a": a if a else static([0, 0, 0]),
                   "s": static([100, 100, 100])},
            "ao": 0, "shapes": shapes, "ip": 0, "op": LOOP, "st": 0, "bm": 0}

# ---------------------------------------------------------- motion profile --
def ease_in_out(u):
    return u * u * (3 - 2 * u)

def catmull(ps, u):
    """Monotone-ish sample through control points [(t,v)...] at t=u."""
    for i in range(len(ps) - 1):
        (t0, v0), (t1, v1) = ps[i], ps[i + 1]
        if t0 <= u <= t1:
            lu = (u - t0) / (t1 - t0)
            m0 = (v1 - (ps[i - 1][1] if i > 0 else v0)) / 2
            m1 = ((ps[i + 2][1] if i + 2 < len(ps) else v1) - v0) / 2
            lu2, lu3 = lu * lu, lu * lu * lu
            return ((2 * lu3 - 3 * lu2 + 1) * v0 + (lu3 - 2 * lu2 + lu) * m0
                    + (-2 * lu3 + 3 * lu2) * v1 + (lu3 - lu2) * m1)
    return ps[-1][1]

# The stroke, as bar-progress 0 (lockout) -> 1 (chest) per frame.
# f0-6 hold high | f6-38 descent | f38-46 touch | f46-74 press | f74-96 settle
PRESS_CURVE = [(0.0, 1.0), (0.09, 0.965),                             # force builds
               (0.24, 0.70), (0.43, 0.46), (0.61, 0.34),               # sticking
               (0.82, 0.10), (1.0, 0.0)]

def bar_progress(f):
    if f <= 6:
        return 0.0
    if f <= 38:
        return ease_in_out((f - 6) / 32)
    if f <= 46:
        return 1.0
    if f <= 74:
        return max(0.0, catmull(PRESS_CURVE, (f - 46) / 28))
    return 0.0

def bar_pos(f):
    u = bar_progress(f)
    x = BAR_TOP[0] + (BAR_BOT[0] - BAR_TOP[0]) * u
    y = BAR_TOP[1] + (BAR_BOT[1] - BAR_TOP[1]) * u
    # Lockout overshoot: 2 px past the top right after the press, settled by ~f84.
    if 74 < f < 88:
        s = (f - 74) / 14
        y -= 2.6 * math.sin(math.pi * s) * math.exp(-2.2 * s)
    # Touch settle: 1.5 px give as the bar meets the chest.
    if 38 < f < 46:
        s = (f - 38) / 8
        y += 1.5 * math.sin(math.pi * s)
    return x, y

def solve_arm(shoulder, hand):
    """Two-bone IK, elbow toward the feet (+x). Returns (elbow, wrist)."""
    sx, sy = shoulder
    hx, hy = hand
    dx, dy = hx - sx, hy - sy
    d = math.hypot(dx, dy)
    d = max(abs(L1 - L2) + 2.0, min(L1 + L2 - 0.5, d))
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h2 = max(0.0, L1 * L1 - a * a)
    hgt = math.sqrt(h2)
    mx, my = sx + a * dx / d, sy + a * dy / d
    # Two mirror solutions; the elbow flares toward the feet.
    e1 = (mx - hgt * dy / d, my + hgt * dx / d)
    e2 = (mx + hgt * dy / d, my - hgt * dx / d)
    elbow = e1 if e1[0] > e2[0] else e2
    return elbow, (hx, hy)

# Sample times: dense through motion, sparse through holds.
def sample_frames():
    fs = [0, 6]
    fs += list(range(8, 47, 2))
    fs += list(range(48, 75, 2))
    fs += list(range(76, 90, 2))
    fs += [92, LOOP]
    return sorted(set(fs))

FRAMES = sample_frames()

def dense_at(f):
    return 6 < f < 90

def chest_lift(f):
    """The effort arch: the chest rises ~2.5 px through the drive."""
    if 46 <= f <= 80:
        s = (f - 46) / 34
        fade = 1.2 * max(0.0, 1 - (f - 46) / 6)     # hand-off from the settle
        return fade - 2.5 * math.sin(math.pi * min(1.0, s * 1.25))
    if 30 <= f <= 46:                       # settles INTO the chest on descent
        return 1.2 * ease_in_out((f - 30) / 16)
    if 80 < f < 96:
        return 0.0
    return 0.0

# ------------------------------------------------------------- the layers --
def arm_layers(tag, off, delay, skin_up, skin_lo, sleeve):
    """Upper arm + forearm + hand for one side, baked in world space."""
    ups, downs, hands = [], [], []
    for f in FRAMES:
        fb = max(0, f - delay)              # the far arm trails by `delay`
        bx, by = bar_pos(fb)
        lift = chest_lift(fb)
        s = (SHOULDER[0] + off[0], SHOULDER[1] + off[1] + lift)
        hpos = (bx + off[0], by + off[1])
        elbow, wrist = solve_arm(s, hpos)
        up_r = math.degrees(math.atan2(elbow[0] - s[0], -(elbow[1] - s[1]))) - 180
        lo_r = math.degrees(math.atan2(wrist[0] - elbow[0], -(wrist[1] - elbow[1]))) - 180
        d = dense_at(f)
        ups.append((f, [s[0], s[1], 0], up_r, d))
        downs.append((f, [elbow[0], elbow[1], 0], lo_r, d))
        hands.append((f, [wrist[0], wrist[1], 0], d))

    def unwrap(seq):
        out, prev = [], None
        for t, p, r, d in seq:
            if prev is not None:
                while r - prev > 180: r -= 360
                while r - prev < -180: r += 360
            prev = r
            out.append((t, p, r, d))
        return out

    ups, downs = unwrap(ups), unwrap(downs)
    up = layer(0, f"upper arm {tag}",
               [shape(capsule(0, -6, 0, L1, 15), skin_up),
                shape(capsule(0, -8, 0, 26, 20), sleeve)][::-1],
               p=keyframes([(t, p, d) for t, p, _, d in ups], spatial=True),
               r=keyframes([(t, r, d) for t, _, r, d in ups]))
    lo = layer(0, f"forearm {tag}",
               [shape(capsule(0, -4, 0, L2, 12), skin_lo)],
               p=keyframes([(t, p, d) for t, p, _, d in downs], spatial=True),
               r=keyframes([(t, r, d) for t, _, r, d in downs]))
    hand = layer(0, f"hand {tag}",
                 [shape(circle(0, 0, 12.5), skin_lo)],
                 p=keyframes([(t, p, d) for t, p, d in hands], spatial=True))
    return up, lo, hand

def build():
    layers = []

    # -- barbell: end cap + hub + ring + plate, riding the bar point --------
    bar_keys = [(f, [*bar_pos(f), 0], dense_at(f)) for f in FRAMES]
    layers.append(layer(0, "barbell", [
        shape(circle(0, 0, 7), BAR_METAL),
        shape(circle(0, 0, 15), dim(PLATE_RING, 1.35)),
        shape(circle(0, 0, 26), PLATE_RING),
        shape(circle(0, 0, 40), PLATE),
    ], p=keyframes(bar_keys, spatial=True)))

    # -- near arm ----------------------------------------------------------
    up_n, lo_n, hand_n = arm_layers("near", (0, 0), 0, SKIN, SKIN_LO, ACCENT)
    layers += [hand_n, lo_n, up_n]

    # -- head (static: it rests on the bench) ------------------------------
    layers.append(layer(0, "head", [
        shape(wedge([[209, 416], [195, 417], [204, 428]]), SKIN),        # nose
        shape(circle(226, 443, 25), SKIN),                               # face
        shape(circle(224, 449, 5), dim(SKIN, 0.82)),                     # ear
        shape(circle(217, 441, 27), HAIR),                               # hair
        shape(capsule(242, 438, 268, 442, 10), SKIN),                    # neck
    ]))

    # -- torso: the shirt, arching against the press -----------------------
    lift_keys = []
    for f in FRAMES:
        lift = chest_lift(f)
        lift_keys.append((f, [340, 445 + lift, 0], dense_at(f)))
    layers.append(layer(0, "torso", [
        shape(capsule(264, 444, 400, 447, 23), SHIRT),
        shape(capsule(268, 440, 276, 452, 12), TRIM),                    # collar
    ][::-1], p=keyframes(lift_keys, spatial=True), a=static([340, 445, 0])))

    layers.append(layer(0, "shorts",
                        [shape(capsule(390, 448, 456, 451, 22), SHORTS)]))

    # -- near leg (planted, like the reference keeps idle limbs) -----------
    layers.append(layer(0, "near leg", [
        shape(capsule(*HIP, *KNEE, 17), SKIN),
        shape(capsule(*KNEE, *ANKLE, 13), SKIN),
        shape(rrect(548, 534, 601, 558, 8), SHOE),                       # shoe
        shape(rrect(548, 552, 601, 559, 3), TRIM),                       # sole
        shape(rrect(548, 546, 601, 552, 3), ACCENT),                     # stripe
    ][::-1]))

    # -- bench -------------------------------------------------------------
    layers.append(layer(0, "bench", [
        shape(rrect(150, BENCH_TOP, 475, BENCH_TOP + 30, 10), SHOE),
        shape(rrect(192, BENCH_TOP + 26, 216, 558, 6), SHOE_DARK),
        shape(rrect(420, BENCH_TOP + 26, 444, 558, 6), SHOE_DARK),
    ]))

    # -- far arm (trails one frame; darker) --------------------------------
    up_f, lo_f, hand_f = arm_layers("far", FAR_OFF, 1,
                                    dim(SKIN), dim(SKIN_LO), dim(ACCENT))
    layers += [hand_f, lo_f, up_f]

    # -- far leg -----------------------------------------------------------
    o = (-12, -9)
    layers.append(layer(0, "far leg", [
        shape(capsule(HIP[0] + o[0], HIP[1] + o[1], KNEE[0] + o[0], KNEE[1] + o[1], 16), dim(SKIN)),
        shape(capsule(KNEE[0] + o[0], KNEE[1] + o[1], ANKLE[0] + o[0], ANKLE[1] + o[1], 12), dim(SKIN)),
        shape(rrect(548 + o[0], 534 + o[1], 599 + o[0], 556 + o[1], 8), dim(SHOE)),
    ][::-1]))

    # -- background --------------------------------------------------------
    layers.append({"ddd": 0, "ind": 0, "ty": 1, "nm": "bg", "sr": 1,
                   "ks": {"o": static(100), "r": static(0),
                          "p": static([W / 2, H / 2, 0]),
                          "a": static([W / 2, H / 2, 0]),
                          "s": static([100, 100, 100])},
                   "sw": W, "sh": H, "sc": "#ffffff",
                   "ip": 0, "op": LOOP, "st": 0, "bm": 0})

    for i, l in enumerate(layers):
        l["ind"] = i + 1

    return {"v": "5.7.8", "fr": FPS, "ip": 0, "op": LOOP, "w": W, "h": H,
            "nm": "bench_press", "ddd": 0, "assets": [], "layers": layers}

if __name__ == "__main__":
    doc = clean(build())
    out = pathlib.Path(__file__).resolve().parent.parent / "assets" / "BenchPress.json"
    out.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB, {LOOP} frames @ {FPS} fps)")
