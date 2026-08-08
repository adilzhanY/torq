#!/usr/bin/env bash
# Generate torq's sound effects with ffmpeg. Run from the repo root:
#     ./scripts/build-sounds.sh
#
# WHY SYNTHESIZED rather than downloaded: stock "free" SFX packs come with
# attribution strings and licence terms that have to survive into a paid app,
# and most of them are cinematic whooshes that fight this design. These are
# plucked sine tones with a fast exponential decay — the audio equivalent of
# the app itself: dark, sharp, no ornament. Being generated also means they
# are unambiguously ours to ship, and tweaking one is editing a number here.
#
# Musical design: everything sits in A minor pentatonic, so two sounds that
# land close together (finish a set while the rest timer counts) still agree
# with each other instead of clashing. Pitch rises with significance:
# tick < set done < go < workout done.
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd -P)"
OUT="assets/sounds"
mkdir -p "$OUT"

SR=48000

# A plucked note: fundamental + a quiet octave for body, exponential decay,
# and a 4 ms attack ramp so it never starts on a click.
note() { # freq decay_k duration gain
  echo "aevalsrc='$4*(sin(2*PI*$1*t)+0.22*sin(2*PI*2*$1*t)+0.08*sin(2*PI*3*$1*t))*exp(-t*$2)*min(1,t/0.004)':d=$3:s=$SR"
}

enc() { # out.m4a
  # AAC at 128k mono: small files, no gaps, plays on every Android device.
  ffmpeg -hide_banner -loglevel error -y -ac 1 -c:a aac -b:a 128k "$1"
}

A4=440; C5=523.25; D5=587.33; E5=659.25; G5=783.99; A5=880; C6=1046.50; E6=1318.51

# ── set done: crisp two-note blip, the sound you'll hear most ──────────────
# Short and dry on purpose — a long tone every set would grate by set 20.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "$(note $E5 26 0.20 0.55)" \
  -f lavfi -i "$(note $A5 24 0.24 0.42)" \
  -filter_complex "[0]adelay=0[a];[1]adelay=55[b];[a][b]amix=inputs=2:normalize=0,alimiter=limit=0.9" \
  -ac 1 -c:a aac -b:a 128k "$OUT/set-done.m4a"

# ── rest countdown tick: 3… 2… 1 ──────────────────────────────────────────
# Deliberately quieter and lower than everything else: it repeats three times
# and must not feel like an alarm.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "$(note $A4 30 0.16 0.34)" \
  -ac 1 -c:a aac -b:a 128k "$OUT/rest-tick.m4a"

# ── go: rest is over, the one that has to cut through gym noise ───────────
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "$(note $A5 12 0.55 0.5)" \
  -f lavfi -i "$(note $E6 14 0.5 0.3)" \
  -filter_complex "[0]adelay=0[a];[1]adelay=0[b];[a][b]amix=inputs=2:normalize=0,alimiter=limit=0.92" \
  -ac 1 -c:a aac -b:a 128k "$OUT/rest-go.m4a"

# ── workout done: rising pentatonic run, earned but not a fanfare ─────────
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "$(note $A4 16 0.9 0.42)" \
  -f lavfi -i "$(note $C5 16 0.8 0.42)" \
  -f lavfi -i "$(note $E5 15 0.7 0.42)" \
  -f lavfi -i "$(note $A5 11 0.9 0.46)" \
  -filter_complex "[0]adelay=0[a];[1]adelay=110[b];[2]adelay=220[c];[3]adelay=330[d];[a][b][c][d]amix=inputs=4:normalize=0,alimiter=limit=0.92" \
  -ac 1 -c:a aac -b:a 128k "$OUT/workout-done.m4a"

# ── personal record: same run, higher and with a sparkle on top ──────────
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "$(note $E5 16 0.9 0.40)" \
  -f lavfi -i "$(note $G5 16 0.8 0.40)" \
  -f lavfi -i "$(note $C6 14 0.8 0.42)" \
  -f lavfi -i "$(note $E6 10 1.0 0.44)" \
  -filter_complex "[0]adelay=0[a];[1]adelay=95[b];[2]adelay=190[c];[3]adelay=285[d];[a][b][c][d]amix=inputs=4:normalize=0,alimiter=limit=0.92" \
  -ac 1 -c:a aac -b:a 128k "$OUT/pr.m4a"

echo "Built:"
ls -la "$OUT"
