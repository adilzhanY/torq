#!/usr/bin/env python3
"""Turn raw screenshots into the README's artwork. From the repo root:

    ./scripts/build-shots.py

Reads every docs/shots/<name>.png captured by scripts/snap.sh and writes:

  docs/shots/framed/<name>.png   rounded + bezelled + shadowed "device"
  docs/shots/hero.png            the 2600x1400 banner at the top of the README

Re-run it after refreshing any screenshot; it is deterministic and safe to
run repeatedly. Needs ImageMagick 7 (`magick`) and `rsvg-convert`.

WHY FRAME THEM: a raw Android grab on a white README reads as a bug report.
Rounding the corners, adding a hairline bezel in the app's own border colour
and dropping a soft shadow is the difference between "here is a screenshot"
and "here is a product".

GOTCHA that cost a debugging round: a mask drawn on `xc:none` with no
`-fill` uses ImageMagick's DEFAULT fill, which is BLACK. Used as a
CopyOpacity source that makes the entire image transparent, and you end up
compositing an empty bezel over your background with no idea why. The mask
must be `xc:black -fill white`.
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SHOTS = REPO / "docs" / "shots"
FRAMED = SHOTS / "framed"
FONTS = REPO / "node_modules" / "@expo-google-fonts" / "space-grotesk"
FONT_BOLD = FONTS / "700Bold" / "SpaceGrotesk_700Bold.ttf"
FONT_MED = FONTS / "500Medium" / "SpaceGrotesk_500Medium.ttf"
LOGO = REPO / "assets" / "logo.svg"

# torq's own tokens. The artwork has to look like the app it is selling.
PAGE, LIME, INK, SOFT, BEZEL = "#0E0F0E", "#C8FE23", "#F2F4EE", "#9AA294", "#2A2F27"

# The three phones in the hero, back to front. Home leads because it is the
# screen that states what the product is for.
HERO = [("ranks", 470), ("stats", 470), ("home", 620)]

HEADLINE = "torq"
KICKER = "STRENGTH, RANKED."
LEAD = [
    "A workout log that answers the only question",
    "that matters: am I actually getting stronger?",
]
CLAIMS = [
    "Live set logger, built for the gym floor",
    "DOTS-normalised ranks across nine tiers",
    "1,500 exercises · offline-first · your data",
]


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def size(path):
    out = subprocess.run(
        ["magick", str(path), "-format", "%w %h", "info:"],
        capture_output=True, text=True, check=True,
    ).stdout
    return tuple(int(v) for v in out.split())


def frame(src: Path, dst: Path, width: int) -> Path:
    """Round, bezel and shadow one screenshot."""
    radius = width // 14
    tmp = dst.parent / f".tmp-{dst.stem}"
    tmp.mkdir(parents=True, exist_ok=True)
    run("magick", src, "-resize", f"{width}x", tmp / "s.png")
    w, h = size(tmp / "s.png")
    # `-fill white`: see the module docstring.
    run("magick", "-size", f"{w}x{h}", "xc:black", "-fill", "white",
        "-draw", f"roundrectangle 0,0,{w - 1},{h - 1},{radius},{radius}", tmp / "mask.png")
    run("magick", tmp / "s.png", tmp / "mask.png",
        "-alpha", "off", "-compose", "CopyOpacity", "-composite", tmp / "rounded.png")
    b = 3
    run("magick", "-size", f"{w + b * 2}x{h + b * 2}", "xc:none", "-fill", BEZEL,
        "-draw", f"roundrectangle 0,0,{w + b * 2 - 1},{h + b * 2 - 1},{radius + b},{radius + b}",
        tmp / "bezel.png")
    run("magick", tmp / "bezel.png", tmp / "rounded.png",
        "-geometry", f"+{b}+{b}", "-compose", "over", "-composite", tmp / "dev.png")
    run("magick", tmp / "dev.png",
        "(", "+clone", "-background", "black", "-shadow", "55x28+0+16", ")",
        "+swap", "-background", "none", "-layers", "merge", "+repage", dst)
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    return dst


def annotate(img, x, y, text, points, color, font, kerning=0):
    run("magick", img, "-font", font, "-pointsize", points, "-fill", color,
        "-kerning", kerning, "-annotate", f"+{x}+{y}", text, img)


def build_hero(work: Path):
    W, H = 2600, 1400
    phones = {}
    for name, width in HERO:
        src = SHOTS / f"{name}.png"
        if not src.exists():
            sys.exit(f"hero needs {src}: capture it with ./scripts/snap.sh {name}")
        phones[name] = frame(src, work / f"h-{name}.png", width)

    hero = SHOTS / "hero.png"
    run("magick", "-size", f"{W}x{H}", f"xc:{PAGE}", work / "canvas.png")
    # A lime glow behind the phones so the right half is not a black slab.
    run("magick", "-size", "1400x1400", "radial-gradient:#C8FE2333-none",
        "-resize", "1600x1400!", work / "glow.png")
    run("magick", work / "canvas.png", work / "glow.png",
        "-geometry", "+1150+0", "-composite", work / "base.png")
    # The vortex, huge and dimmed, bleeding off the bottom-left. Same
    # watermark idea as the app's own hero panel.
    run("rsvg-convert", "-w", "900", "-h", "900", LOGO, "-o", work / "mark.png")
    run("magick", work / "mark.png", "-alpha", "set", "-channel", "A",
        "-evaluate", "multiply", "0.06", "+channel", work / "markdim.png")
    run("magick", work / "base.png", work / "markdim.png",
        "-geometry", "-260+740", "-composite", work / "base.png")

    rw, rh = size(phones["ranks"])
    sw, sh = size(phones["stats"])
    hw, hh = size(phones["home"])
    run("magick", work / "base.png",
        phones["ranks"], "-geometry", f"+1180+{(H - rh) // 2 - 20}", "-composite",
        phones["stats"], "-geometry", f"+{W - sw - 40}+{(H - sh) // 2 - 20}", "-composite",
        phones["home"], "-geometry", f"+{1180 + rw - 190}+{(H - hh) // 2}", "-composite",
        hero)

    run("rsvg-convert", "-w", "150", "-h", "150", LOGO, "-o", work / "logo150.png")
    run("magick", hero, work / "logo150.png", "-geometry", "+150+300", "-composite", hero)
    annotate(hero, 150, 590, HEADLINE, 190, INK, FONT_BOLD, -6)
    annotate(hero, 150, 690, KICKER, 54, LIME, FONT_BOLD, 6)
    for i, line in enumerate(LEAD):
        annotate(hero, 150, 790 + i * 60, line, 44, SOFT, FONT_MED)
    run("magick", hero, "-fill", LIME, "-draw", "rectangle 150,920 330,928", hero)
    for i, line in enumerate(CLAIMS):
        annotate(hero, 150, 1010 + i * 66, "-   " + line, 40, INK, FONT_MED)
    print(f"hero.png  {size(hero)[0]}x{size(hero)[1]}")


def main():
    if not FONT_BOLD.exists():
        sys.exit("run `npm install` first, the hero is set in the real Space Grotesk")
    FRAMED.mkdir(parents=True, exist_ok=True)
    work = SHOTS / ".work"
    work.mkdir(exist_ok=True)

    for src in sorted(SHOTS.glob("*.png")):
        if src.name == "hero.png":
            continue
        frame(src, FRAMED / src.name, 620)
        print(f"framed/{src.name}")

    build_hero(work)
    for f in work.iterdir():
        f.unlink()
    work.rmdir()


if __name__ == "__main__":
    main()
