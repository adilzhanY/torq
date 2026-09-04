# Refreshing the README screenshots

The README is a product page. Its artwork is generated, not hand-made, so
when a screen changes you re-shoot that one screen and rebuild. You never
redo the layout.

```bash
./run_android.sh torq2          # emulator + Metro
# …stage the app (see the shot list below)…
./scripts/snap.sh home          # writes docs/shots/home.png, status bar cropped
./scripts/build-shots.py        # rebuilds docs/shots/framed/* and hero.png
```

Needs ImageMagick 7 (`magick`), `rsvg-convert`, and `npm install` done (the
hero is set in the real Space Grotesk shipped in `node_modules`).

## Stage before you shoot

The whole reason these look good is that the app was **put into a good state
first**. An honest screenshot of an empty app sells nothing, and a screenshot
of fake data would be a lie, so use the seeded demo history, which is real
data produced by the real code.

- **Seed history**: Profile → Settings → Developer → *Seed demo workouts*.
  Twelve weeks of progressive PPL with a plateau and a deload, which is what
  makes the Progress chart and the History timeline worth showing.
- **Have a plan**: Profile → Training plan → *Rebuild plan*, so Home shows a
  training day rather than "No plan yet".
- **No live session** before shooting Home, or the hero becomes the
  "Workout in progress" card instead of the training-day panel.
- **Dismiss the keyboard** with `adb shell input keyevent 111` before any
  shot: Android's floating IME toolbar (a white pill) sits over the app and
  ruins the frame.
- After editing code, **force-stop Expo Go** before relaunching, because
  `am start` alone happily serves the cached bundle and you will shoot the
  old build.

## The shot list

Each one has a job in the README. If a feature changes the screen, re-shoot
it; if a feature adds a screen worth selling, add it here first.

| Name | Screen | Must show |
|---|---|---|
| `home` | Home, a training day | Lime hero panel with the vortex watermark, week strip, rank tiles |
| `live` | Workout, session active | Warm-up W rows, two ticked lime sets, a running rest countdown |
| `ranks` | Ranks → You | Big animated hex-track badge (gem on the track, corner studs at Gold), points, per-lift rows with percentiles |
| `stats` | Stats | The rank line with tier bands, the dumbbell "what moved" chart |
| `history` | History | Rail with lime PR nodes, PR/points chips, a "1 day off" marker |
| `summary` | History → tap a session | The stats bar and trophy PR pills |
| `library` | Workout → Exercise library | The catalog rows: name, muscle chips, equipment. NO thumbnails, demo media is off since 2026-08-16 |
| `warmup` | Live session → ⋯ → Add warm-up sets | The dialog with real kilos beside each formula |
| `streak` | Home → streak pill | The lime streak creature, the count, the week strip. NOT the old orange flame, that asset is deleted |
| `workout` | Workout, no session | Quick start, routines, recommended |
| `profile` | Profile | Avatar, rank strip, best lifts with percentiles |

`hero.png` is composed from `home`, `ranks` and `stats`, so refreshing any of
those three updates the banner on the next build.

## If the device changes

`scripts/snap.sh` crops `1080x2232+0+120`, which removes exactly the status
bar and the gesture pill on a 1080x2400 emulator at 3x. On a different
density or a notched device, screenshot once, find the first row of app
content, and re-measure. Do not nudge the number until it "looks right".
