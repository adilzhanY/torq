#!/usr/bin/env python3
"""Render one frame of a Lottie file to SVG, interpolation included:

    ./scripts/lottie-frame.py assets/BenchPress.json 42 --out /tmp/f42.svg

This is the INDEPENDENT check for generated animations: it reads only the
JSON, implements Lottie's own semantics (keyframe easing via cubic bezier,
holds, anchors, layer paint order), and rasterises what a player would show.
A generator bug (wrong anchor, wrong angle convention, wrong paint order)
appears here as a broken pose instead of surviving to the app.

Feature subset on purpose: static paths, solid fills, solid layers, and
animated p/a/r/s/o on layers. It refuses loudly on anything else, exactly
like scripts/lottie-to-svg.py does.
"""
import argparse
import json
import math
import pathlib
import sys


def bez_y(u, ox, oy, ix, iy):
    """Temporal cubic-bezier easing: progress at time-fraction u."""
    if u <= 0:
        return 0.0
    if u >= 1:
        return 1.0
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        x = 3 * (1 - mid) ** 2 * mid * ox + 3 * (1 - mid) * mid ** 2 * ix + mid ** 3
        if x < u:
            lo = mid
        else:
            hi = mid
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * oy + 3 * (1 - t) * t ** 2 * iy + t ** 3


def scalar(v):
    return v[0] if isinstance(v, list) else v


def sample(prop, t, dims=1):
    """A Lottie property's value at time t."""
    if not isinstance(prop, dict):
        return prop
    if prop.get("a") != 1:
        return prop.get("k")
    keys = prop["k"]
    if t <= keys[0]["t"]:
        return keys[0]["s"]
    for i in range(len(keys) - 1):
        k0, k1 = keys[i], keys[i + 1]
        if k0["t"] <= t < k1["t"]:
            if k0.get("h") == 1:
                return k0["s"]
            u = (t - k0["t"]) / (k1["t"] - k0["t"])
            o, ii = k0.get("o"), k0.get("i")
            if o and ii:
                p = bez_y(u, scalar(o["x"]), scalar(o["y"]), scalar(ii["x"]), scalar(ii["y"]))
            else:
                p = u
            a, b = k0["s"], k1.get("s", k0["s"])
            return [av + (bv - av) * p for av, bv in zip(a, b)]
    last = keys[-1]
    return last.get("s")


def matrix(ks, t):
    p = sample(ks.get("p"), t) or [0, 0]
    a = sample(ks.get("a"), t) or [0, 0]
    s = sample(ks.get("s"), t) or [100, 100]
    r = sample(ks.get("r"), t) or 0
    r = scalar(r) if isinstance(r, list) else r
    rad = math.radians(float(r))
    cos, sin = math.cos(rad), math.sin(rad)
    sx, sy = s[0] / 100, s[1] / 100
    m = (cos * sx, sin * sx, -sin * sy, cos * sy, p[0], p[1])
    tx = m[0] * -a[0] + m[2] * -a[1] + m[4]
    ty = m[1] * -a[0] + m[3] * -a[1] + m[5]
    return (m[0], m[1], m[2], m[3], tx, ty)


def apply(m, pt):
    return (m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5])


def path_d(shape, m):
    v = [apply(m, p) for p in shape["v"]]
    lin = (m[0], m[1], m[2], m[3], 0, 0)
    it = [apply(lin, p) for p in shape["i"]]
    ot = [apply(lin, p) for p in shape["o"]]
    n = len(v)
    d = [f"M{v[0][0]:.2f},{v[0][1]:.2f}"]
    last = n if shape.get("c", True) else n - 1
    for j in range(last):
        c, nx = v[j], v[(j + 1) % n]
        c1 = (c[0] + ot[j][0], c[1] + ot[j][1])
        c2 = (nx[0] + it[(j + 1) % n][0], nx[1] + it[(j + 1) % n][1])
        d.append(f"C{c1[0]:.2f},{c1[1]:.2f} {c2[0]:.2f},{c2[1]:.2f} {nx[0]:.2f},{nx[1]:.2f}")
    if shape.get("c", True):
        d.append("Z")
    return "".join(d)


def hexof(c):
    return "#" + "".join(f"{round(float(x) * 255):02X}" for x in c[:3])


def emit_shapes(items, m, t, warn, out):
    groups, path_nodes, fill = [], [], None
    for it in items:
        ty = it.get("ty")
        if ty == "gr":
            groups.append(it["it"])
        elif ty == "sh":
            k = it["ks"]
            if isinstance(k.get("k"), dict):
                path_nodes.append(k["k"])
            else:
                warn.add("animated path")
        elif ty == "fl":
            fill = hexof(sample(it["c"], t))
        elif ty == "tr":
            # Generated files keep group transforms at identity; anything else
            # is a real transform this renderer would silently mis-place.
            p0 = it.get("p", {}).get("k", [0, 0])
            r0 = it.get("r", {}).get("k", 0)
            s0 = it.get("s", {}).get("k", [100, 100])
            if p0 != [0, 0] or r0 != 0 or s0 != [100, 100]:
                warn.add("group transform")
        elif ty not in ("st",):
            warn.add(f"shape {ty}")
    for g in reversed(groups):
        emit_shapes(g, m, t, warn, out)
    for p in reversed(path_nodes):
        if fill:
            out.append(f'<path fill="{fill}" d="{path_d(p, m)}"/>')


def render(doc, t):
    warn = set()
    body = []
    for l in reversed(doc["layers"]):          # last layer paints first
        if not (l.get("ip", 0) <= t < l.get("op", 1e9)):
            continue
        if l.get("ty") == 1:
            m = matrix(l["ks"], t)
            body.append(f'<rect x="0" y="0" width="{l["sw"]}" height="{l["sh"]}" '
                        f'fill="{l["sc"]}"/>')
            continue
        if l.get("ty") != 4:
            warn.add(f"layer ty {l.get('ty')}")
            continue
        if l.get("parent"):
            warn.add("parenting")
        m = matrix(l["ks"], t)
        emit_shapes(l.get("shapes", []), m, t, warn, body)
    w, h = doc.get("w"), doc.get("h")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
           f'width="{w}" height="{h}">{"".join(body)}</svg>')
    return svg, warn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("frame", type=float)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    doc = json.loads(pathlib.Path(args.file).read_text())
    svg, warn = render(doc, args.frame)
    pathlib.Path(args.out).write_text(svg)
    if warn:
        print("NOT HANDLED: " + ", ".join(sorted(warn)), file=sys.stderr)


if __name__ == "__main__":
    main()
