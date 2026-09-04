#!/usr/bin/env python3
"""Recolour a Lottie file to torq's palette. From the repo root:

    ./scripts/recolor-lottie.py assets/Streak.json --map CCFF00=C8FE23

Lottie stores every fill and stroke as normalised RGB floats, so a colour is
just three numbers in the JSON. Rewriting them is exact, costs nothing at
runtime, and works on every renderer.

WHY EDIT THE FILE rather than tint at runtime: lottie-react-native's
`colorFilters` prop matches on KEYPATHS, which means the layer and shape
names inside the file have to be addressable and stable. Downloaded packs
name their groups "Group 3", the matching behaves differently on iOS and
Android, and it can only replace a whole keypath's colour. When the asset is
ours to edit, editing it is the honest answer. Runtime tinting earns its keep
only when one file has to appear in several colours at once.

To ship a second colourway (an at-risk amber streak, say), run this again
with a different --map and a different --out. Two small files beat one file
plus a pile of keypath plumbing.
"""
import argparse
import json
import pathlib
import sys


def to_rgb(hexstr: str):
    h = hexstr.lstrip("#")
    if len(h) != 6:
        sys.exit(f"not a 6-digit hex colour: {hexstr}")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def as_hex(vals) -> str:
    return "".join(f"{round(float(v) * 255):02X}" for v in vals[:3])


def recolor(node, mapping, counts):
    """Walk the whole document; fills ("fl") and strokes ("st") hold colours."""
    if isinstance(node, dict):
        if node.get("ty") in ("fl", "st"):
            c = node.get("c", {})
            k = c.get("k")
            if isinstance(k, list) and len(k) >= 3 and all(isinstance(x, (int, float)) for x in k[:3]):
                key = as_hex(k)
                if key in mapping:
                    r, g, b = mapping[key]
                    c["k"] = [r, g, b] + list(k[3:])
                    counts[key] = counts.get(key, 0) + 1
        for v in node.values():
            recolor(v, mapping, counts)
    elif isinstance(node, list):
        for v in node:
            recolor(v, mapping, counts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--map", action="append",
                    help="FROM=TO in hex, e.g. CCFF00=C8FE23. Repeatable.")
    ap.add_argument("--out", help="defaults to editing the file in place")
    ap.add_argument("--list", action="store_true", help="only report the colours in the file")
    args = ap.parse_args()
    if not args.list and not args.map:
        ap.error("--map is required unless you pass --list")

    path = pathlib.Path(args.file)
    doc = json.loads(path.read_text())

    if args.list:
        found = {}
        def scan(n):
            if isinstance(n, dict):
                if n.get("ty") in ("fl", "st"):
                    k = n.get("c", {}).get("k")
                    if isinstance(k, list) and all(isinstance(x, (int, float)) for x in k[:3]):
                        found[as_hex(k)] = found.get(as_hex(k), 0) + 1
                for v in n.values():
                    scan(v)
            elif isinstance(n, list):
                for v in n:
                    scan(v)
        scan(doc)
        for c, n in sorted(found.items(), key=lambda kv: -kv[1]):
            print(f"#{c}  x{n}")
        return

    mapping = {}
    for pair in args.map:
        src, _, dst = pair.partition("=")
        mapping[src.lstrip("#").upper()] = to_rgb(dst)

    counts = {}
    recolor(doc, mapping, counts)
    if not counts:
        sys.exit("nothing matched. Run with --list to see the colours in the file.")

    out = pathlib.Path(args.out) if args.out else path
    out.write_text(json.dumps(doc, separators=(",", ":")))
    for src, n in counts.items():
        print(f"#{src} -> #{as_hex(mapping[src])}  x{n}")
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
