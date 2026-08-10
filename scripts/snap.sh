#!/usr/bin/env bash
# Capture one README screenshot off a running emulator. From the repo root:
#
#     ./scripts/snap.sh home
#
# Writes docs/shots/<name>.png, cropped so it is presentable: the Android
# STATUS BAR and the gesture pill are gone, the app's own dock stays (it is
# part of the product, not chrome).
#
# THE CROP IS THE WHOLE POINT. A 1080x2400 emulator frame at 3x carries
# 40 dp of status bar at the top and 16 dp of gesture pill at the bottom.
# 1080x2232+0+120 removes exactly those. If you switch to a device with a
# different density or a notch, re-measure rather than nudging this number:
# screenshot once, open it, and find the first row of app content.
#
# Navigation is deliberately NOT scripted. Getting a screenshot worth
# publishing means staging the app first (see docs/shots/HOW.md), and a
# script that blindly taps coordinates produces the empty states instead.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
ADB="$HOME/Android/Sdk/platform-tools/adb"
OUT="$REPO/docs/shots"
NAME="${1:?usage: ./scripts/snap.sh <name>}"

# Pin to one emulator when several are up (torq / torq2 run side by side).
if [ -z "${ANDROID_SERIAL:-}" ]; then
  ANDROID_SERIAL="$("$ADB" devices | awk '/^emulator-/{print $1; exit}')"
  export ANDROID_SERIAL
fi
[ -n "$ANDROID_SERIAL" ] || { echo "no emulator running"; exit 1; }

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"$ADB" exec-out screencap -p > "$TMP/raw.png"
magick "$TMP/raw.png" -crop 1080x2232+0+120 +repage "$OUT/$NAME.png"
echo "$OUT/$NAME.png  $(magick "$OUT/$NAME.png" -format '%wx%h' info:)"
