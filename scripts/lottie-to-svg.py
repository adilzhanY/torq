#!/usr/bin/env python3
"""Lift one frame of a Lottie file out as a flat SVG. From the repo root:

    ./scripts/lottie-to-svg.py assets/Streak.json --out assets/streak-creature.svg

Why this exists: the streak creature is a designed character, and it needs to
appear as a STILL as well as an animation (the pill on Home shows it next to
the day count, where a five second loop would be noise). Rather than
screenshotting a frame and shipping a raster, this walks the document and
emits the real vector, so the mark stays sharp at any size and can be tinted.

It handles the subset this file uses and says so loudly when it meets
anything else: static bezier paths ("sh"), solid fills ("fl"), nested group
transforms, and precomp references. Animated properties are sampled at their
first keyframe, which is the rest pose. Gradients, masks, trim paths and
merge paths are NOT handled; if the input has them, the output will be
wrong and the script tells you rather than guessing.
"""
import argparse
import json
import math
import pathlib
import sys

UNSUPPORTED = {"gf": "gradient fill", "gs": "gradient stroke", "tm": "trim path",
               "mm": "merge paths", "rp": "repeater"}


def value(prop, default=None):
    """A Lottie property at its first keyframe (static or animated)."""
    if prop is None:
        return default
    if not isinstance(prop, dict):
        return prop
    k = prop.get("k")
    if prop.get("a") == 1 and isinstance(k, list) and k and isinstance(k[0], dict):
        return k[0].get("s", default)
    return k


def matrix_of(tr):
    """Lottie transform as a 2x3 affine, so it can be BAKED into the points.
    Nested <g transform> works in a browser but react-native-svg is fussier
    about transform strings, and flat paths are simpler to review anyway."""
    p = value(tr.get("p"), [0, 0]) or [0, 0]
    a = value(tr.get("a"), [0, 0]) or [0, 0]
    s = value(tr.get("s"), [100, 100]) or [100, 100]
    r = value(tr.get("r"), 0) or 0
    if isinstance(r, list):
        r = r[0]
    rad = math.radians(float(r))
    cos, sin = math.cos(rad), math.sin(rad)
    sx, sy = s[0] / 100, s[1] / 100
    # translate(p) * rotate(r) * scale(s) * translate(-a)
    m = (cos * sx, sin * sx, -sin * sy, cos * sy, p[0], p[1])
    tx = m[0] * -a[0] + m[2] * -a[1] + m[4]
    ty = m[1] * -a[0] + m[3] * -a[1] + m[5]
    return (m[0], m[1], m[2], m[3], tx, ty)


def mul(m, n):
    """m applied after n."""
    return (m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5])


def apply(m, pt):
    return (m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5])


IDENTITY = (1, 0, 0, 1, 0, 0)


def transform_str(tr):
    """Lottie transform to an SVG transform, in Lottie's own order."""
    p = value(tr.get("p"), [0, 0]) or [0, 0]
    a = value(tr.get("a"), [0, 0]) or [0, 0]
    s = value(tr.get("s"), [100, 100]) or [100, 100]
    r = value(tr.get("r"), 0) or 0
    if isinstance(r, list):
        r = r[0]
    parts = [f"translate({p[0]:.4f},{p[1]:.4f})"]
    if abs(float(r)) > 1e-6:
        parts.append(f"rotate({float(r):.4f})")
    if abs(s[0] - 100) > 1e-6 or abs(s[1] - 100) > 1e-6:
        parts.append(f"scale({s[0] / 100:.6f},{s[1] / 100:.6f})")
    parts.append(f"translate({-a[0]:.4f},{-a[1]:.4f})")
    return " ".join(parts)


def bezier_to_d(shape, m=IDENTITY):
    """Lottie stores in/out tangents RELATIVE to each vertex."""
    v = [apply(m, pt) for pt in shape["v"]]
    # tangents are offsets, so they take the linear part only
    lin = (m[0], m[1], m[2], m[3], 0, 0)
    i_t = [apply(lin, pt) for pt in shape["i"]]
    o_t = [apply(lin, pt) for pt in shape["o"]]
    closed = shape.get("c", True)
    d = [f"M{v[0][0]:.3f},{v[0][1]:.3f}"]
    n = len(v)
    last = n if closed else n - 1
    for j in range(last):
        cur, nxt = v[j], v[(j + 1) % n]
        c1 = (cur[0] + o_t[j][0], cur[1] + o_t[j][1])
        c2 = (nxt[0] + i_t[(j + 1) % n][0], nxt[1] + i_t[(j + 1) % n][1])
        d.append(f"C{c1[0]:.3f},{c1[1]:.3f} {c2[0]:.3f},{c2[1]:.3f} {nxt[0]:.3f},{nxt[1]:.3f}")
    if closed:
        d.append("Z")
    return "".join(d)


def hexof(c):
    return "#" + "".join(f"{round(float(x) * 255):02X}" for x in c[:3])


def flatten(items, warn, m=IDENTITY, inherited=None, out=None):
    """Collect (fill, d) with every transform baked into the coordinates."""
    if out is None:
        out = []
    shapes, fill, tr = [], None, None
    for it in items:
        ty = it.get("ty")
        if ty in UNSUPPORTED:
            warn.add(UNSUPPORTED[ty])
        elif ty == "gr":
            shapes.append(("group", it.get("it", [])))
        elif ty == "sh":
            shapes.append(("path", value(it.get("ks"))))
        elif ty == "fl":
            fill = hexof(value(it.get("c")))
        elif ty == "tr":
            tr = it
    here = mul(m, matrix_of(tr)) if tr is not None else m
    use = fill or inherited
    # Lottie paints the list top-first, so emit it reversed (see walk_shapes).
    for kind, payload in reversed(shapes):
        if kind == "group":
            flatten(payload, warn, here, use, out)
        elif use:
            out.append((use, bezier_to_d(payload, here)))
    return out


def walk_shapes(items, out, warn):
    """A Lottie group is (shapes..., fill, transform) with the transform LAST
    and applying to everything before it, so the group is emitted as a <g>."""
    paths, fill, tr = [], None, None
    for it in items:
        ty = it.get("ty")
        if ty in UNSUPPORTED:
            warn.add(UNSUPPORTED[ty])
        elif ty == "gr":
            paths.append(("group", it.get("it", [])))
        elif ty == "sh":
            paths.append(("path", value(it.get("ks"))))
        elif ty == "fl":
            fill = (hexof(value(it.get("c"))), float(value(it.get("o"), 100)) / 100)
        elif ty == "tr":
            tr = it
    body = []
    for kind, payload in paths:
        if kind == "group":
            body.append(walk_shapes(payload, [], warn))
        else:
            body.append(f'<path d="{bezier_to_d(payload)}"/>')
    # PAINT ORDER IS REVERSED. In Lottie (and After Effects) the FIRST shape
    # in the list is on top; in SVG the LAST element wins. Emitting the list
    # as-is buries the eyes under the flame, which is exactly what happened
    # on the first run.
    inner = "".join(reversed(body))
    attrs = ""
    if fill:
        attrs += f' fill="{fill[0]}"' + (f' fill-opacity="{fill[1]:.3f}"' if fill[1] < 1 else "")
    if tr is not None:
        attrs += f' transform="{transform_str(tr)}"'
    return f"<g{attrs}>{inner}</g>"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--out", required=True)
    ap.add_argument("--flat", action="store_true",
                    help="bake all transforms into the path data and trim the viewBox")
    args = ap.parse_args()

    doc = json.loads(pathlib.Path(args.file).read_text())
    assets = {a["id"]: a for a in doc.get("assets", []) if "layers" in a}
    warn = set()
    body = []

    def emit_layer(layer):
        if layer.get("ty") == 0 and layer.get("refId") in assets:      # precomp
            inner = "".join(emit_layer(l) or "" for l in assets[layer["refId"]]["layers"])
        elif layer.get("ty") == 4:                                      # shape layer
            inner = walk_shapes(layer.get("shapes", []), [], warn)
        else:
            warn.add(f"layer type {layer.get('ty')}")
            return ""
        return f'<g transform="{transform_str(layer.get("ks", {}))}">{inner}</g>'

    if args.flat:
        paths = []
        for layer in reversed(doc.get("layers", [])):
            m = matrix_of(layer.get("ks", {}))
            if layer.get("ty") == 0 and layer.get("refId") in assets:
                for sub in reversed(assets[layer["refId"]]["layers"]):
                    inner = mul(m, matrix_of(sub.get("ks", {})))
                    flatten(sub.get("shapes", []), warn, inner, None, paths)
            elif layer.get("ty") == 4:
                flatten(layer.get("shapes", []), warn, m, None, paths)
        w, h = doc.get("w", 512), doc.get("h", 512)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
               f'width="{w}" height="{h}" fill="none">'
               + "".join(f'<path fill="{c}" d="{d}"/>' for c, d in paths) + "</svg>")
        pathlib.Path(args.out).write_text(svg)
        if warn:
            print("NOT HANDLED: " + ", ".join(sorted(warn)), file=sys.stderr)
        for c, d in paths:
            print(f"  {c}  {len(d)} chars")
        print(f"wrote {args.out} ({len(svg)} bytes, {len(paths)} paths)")
        return

    for layer in doc.get("layers", []):
        body.append(emit_layer(layer))

    w, h = doc.get("w", 512), doc.get("h", 512)
    # fill="none" at the root: a Lottie path with no fill in its group paints
    # nothing, where an SVG path with no fill would default to black.
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
           f'width="{w}" height="{h}" fill="none">{"".join(reversed(body))}</svg>')
    pathlib.Path(args.out).write_text(svg)
    if warn:
        print("NOT HANDLED, output will be wrong: " + ", ".join(sorted(warn)), file=sys.stderr)
    print(f"wrote {args.out} ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
