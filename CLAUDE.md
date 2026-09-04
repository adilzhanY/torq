@AGENTS.md

# Torq

Personal workout-session tracker (inspired by https://www.strong.app/), built by
Adilzhan. Android-first Expo React Native app. Repo: github.com/adilzhanY/torq.

**Living context file:** update this file after every user-requested change so
the next session knows where the project stands.

**Roadmap:** `PATH.md` holds the business idea, locked redesign decisions,
rank-system design, and the 4-phase plan. Read it before planning any
feature work. `FEATURES.md` holds the premium feature slate (ten ideas
picked 2026-08-11, to be built first and tiered into subscriptions later);
nothing on it is committed to yet.

## Stack

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict)
- NativeWind v5 (preview) + Tailwind CSS v4 + react-native-css 3, CSS-first
  config, no babel plugin. `lightningcss` is pinned to 1.30.1 via npm
  `overrides` (1.32 breaks CSS deserialization in the nativewind metro
  transformer).
- Supabase for auth + cloud sync (optional; app is fully offline-capable)
- @tabler/icons-react-native icons (DEEP imports only, see Icon.tsx),
  Space Grotesk font
  (@expo-google-fonts/space-grotesk; weights 400/500/600/700; the family has
  no 800, so `FONT.extrabold` maps to 700 Bold)
- No router: single-screen shell with a tab switcher (`src/lib/ui.tsx`),
  same as grit mobile.

## Design

**RADIUS: SHARP-10 (2026-08-08, Adilzhan picked it in the lavish review
`.lavish/torq-radius.html`):** the app is no longer pill-round. `R` in
theme.ts is `{ lg: 16, md: 12, ctrl: 10, sm: 8, pill: 999 }`, `ctrl` (10)
is the default for anything pressable, `sm` (8) for inputs/chips/tabs/
thumbnails, `md` (12) for surfaced buttons/tiles/popovers/tooltips, `lg`
(16) for dialogs, sheets and the dock. `pill` is STATUS ONLY (LIVE, tier
pills, PR trophies, streak pill, W/D/F letters), plus true circles
(avatars, week dots, chart dots) and the round caps on thin progress bars.
Never give a plain button a pill. Reasons: the vortex mark is eight sharp
blades, and on a cardless page the interactive shapes are the only geometry
left, so they have to read as controls.

**CARDLESS PRINCIPLE (2026-08-06, Adilzhan: overrides the bento habit):**
stop wrapping content in Card/surface containers. Content is text directly
on the page background; hierarchy comes from type scale, weight, color
(ink/dim/faint + lime accents) and whitespace; where separation is needed,
use thin hairline dividers, not boxes. Surfaces are reserved for
INTERACTIVE elements only (buttons, inputs, the dock) and
true overlays (dialogs, sheets, pickers). Charts keep their plots but lose
their card frames. Applies to every new screen and the Phase-2 rebrand;
existing screens migrate as they're touched. Mockups of all pages in this
style: `.lavish/torq-cardless-pages.html`.

The design is ported from `~/dev/grit/apps/mobile`, a warm clay/bento system:

- Tokens in `src/theme.ts` (`C` palette, `R` radii, `FONT`, `clay()`/`claySm()`
  shadows). The same palette is mirrored as Tailwind theme colors in
  `src/global.css` (`bg-page`, `text-ink`, `bg-surface`, `text-accent`…).
- Brand accent is the logo lime: `C.accent = #C8FE23`, `C.primary = #1A1B1A`
  (the logo's dark square). Lime is LIGHT, anything drawn on it uses
  `C.accentInk` (dark), never white. Used on: quick-start play button, LIVE
  pill, done-set checks, Finish-workout CTA.
- UI primitives in `src/components/ui.tsx`: `Txt`, `Card`, `Pill`,
  `SectionTitle`, `PrimaryButton`, `NumberField`, `TextField`, `Divider`.
- Animations in `src/components/anim.tsx` (`Squish` press, `PopIn`, etc).
- Brand logo in `src/components/Logo.tsx`: the lime (`#C8FE23`) pulse mark on
  a dark (`#1A1B1A`) rounded square, drawn with react-native-svg from the
  brand SVG Adilzhan supplied. Exports `LOGO_BG`/`LOGO_FG`; used in the top
  bar and both loading screens.
- `src/tw/` re-exports react-native-css pre-wrapped components (`View`, `Text`,
  …) for className usage. Most existing screens use style objects + theme
  tokens (grit's style); either is fine.

## Data layer (copied from grit, adapted for workouts)

Local-first: the whole dataset is one JSON blob in AsyncStorage
(`src/lib/db.ts`, key `torq.db.v1`). Domain types in `src/types.ts`:
`Exercise`, `Routine`, `Workout` (with `WorkoutEntry` → `WorkoutSet`),
`Measurement`, `Settings`.

**Units (2026-09-04):** every weight is stored in `settings.unit`. Changing
the unit CONVERTS the data (`convertDB` in units.ts via `updateSettings`),
it never relabels it. The audit's "store kg internally" plan was rejected as
a sixty-site rewrite for the same invariant.

**Persistence guarantees (2026-09-04):** `loadDB` validates shape and parks
anything malformed under `BACKUP_KEY` with `loadError`; `saveDB` never
throws, sets `saveError` (red banner in App.tsx), and coalesces writes so a
burst of commits is at most two writes; `wipeLocal` waits for the queue.
Store actions REPLACE arrays on every mutation: never `.push` into
`dbRef.current.*`, or memoised screens will not notice.

Cloud sync (`src/lib/sync.ts`) is grit's last-write-wins delta sync against
generic Supabase mirror tables `{ user_id, id, data jsonb, updated_at,
deleted }` with RLS, schema in `supabase/schema.sql` (run it in the Supabase
SQL editor). Tables: `exercises`, `routines`, `workouts`, `measurements`,
`settings`, `active` (singleton in-progress session). The server stamps
`updated_at` via trigger; sync cursors live in AsyncStorage.
ORDER OF A CYCLE (2026-09-04): pull, resolve each row on the CLIENT stamp
`data.updatedAt` (clamped to cycle time + 5 min), then push survivors and
tombstones. The server stamp is only the pull cursor; comparing on it made
sync last-PUSHER-wins. Tombstones are dropped only when acknowledged,
settings merge over defaults, a local live session is never replaced, own
echoes are skipped. `sync(db, userId, client?)` takes an injectable client;
`sync.test.ts` has an in-memory server. Configure via
`.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
see `.env.example`).

State: `src/lib/store.tsx` (`useStore`) owns the DB + all domain actions and
persists on every commit; `src/lib/auth.tsx` (`useAuth`) wraps Supabase auth.
"My exercises" starts EMPTY by design (no seeding), the user imports from
the ExerciseDB catalog or adds custom ones. The store's load path still
tombstones any leftover `seed-…` rows from the removed starter library.

## ExerciseDB catalog

`src/data/exercisedb.json` is a snapshot of the full open-source ExerciseDB
(1500 exercises) from `https://oss.exercisedb.dev/api/v1/exercises`.

SPLIT FOR STARTUP (2026-08-08, measured not guessed): the full snapshot cost
~274 ms to materialise on EVERY cold start, before the first frame, and
~270 of those 289 ms were the JSON itself, not the map/sort around it, so
deferring the transform would have saved nothing. `instructions` was 786 KB
of 1141 KB (69%) and is read on exactly one screen, and `gifUrl` was another
89 KB of pure duplication of a template around `exerciseId`. So
`scripts/split-catalog.py` now emits two files: the core
`exercisedb.json` (271 KB, loaded at startup, gifUrl derived) and
`exercisedb-instructions.json` (776 KB, id → steps), which
`dbInstructions(id)` pulls in with an INLINE require the first time the
About tab needs it. Catalog load: 289 ms → 86 ms. Re-run the script after
refreshing the snapshot.
Pagination gotchas: pages are capped at 25 rows and the cursor param is
`after=<meta.nextCursor>`, the documented `cursor` param is silently ignored
(you get the same page forever). `src/lib/exercisedb.ts` loads the snapshot
and maps ExerciseDB body parts/equipment onto Torq's enums.

**DEMO MEDIA IS OFF (2026-08-16).** `EXERCISE_MEDIA_ENABLED` in
`exercisedb.ts` is the single seam: false makes `gifUrl` undefined and
`DB_GIF_BY_ID` empty, and every consumer already branched on a missing gif,
so no screen needed a redesign to lose them. Two reasons, and the second is
the real one:

- QUALITY. The gifs are 180x180 with 12 frames. The About tab drew them at
  `width: "100%"`, which on a 3x phone is 984 physical pixels, a 5.5x
  upscale that invents 97% of what you see. Measured with ImageMagick
  against the real files, not estimated.
- LICENCE. They came from ExerciseDB's open v1 endpoint, which publishes the
  DATA and never granted commercial rights to the MEDIA. The vendor has
  since rebranded to AscendAPI and moved its media behind paid plans and
  signed URLs. Mirroring someone else's artwork in a paid Play app is a
  takedown risk. The instruction TEXT is not affected, which is why the
  About tab now leads with the how-to steps.

Historic note, still true if media is ever switched back on: the dataset's
own `gifUrl` points at `static.exercisedb.dev`, a domain with NO DNS record
(dead), so `MEDIA_BASE` points at Adilzhan's mirror
`github.com/adilzhanY/exercise-db` instead (all 1500 under `media/<id>.gif`,
verified identical dataset) via `raw.githubusercontent.com`. Media is
remote-only (bundling ~1500 would add ~258 MB); `expo-image` caches with
`cachePolicy="memory-disk"`. Exercises imported from the catalog carry
`dbId` on the `Exercise` row, which keys `DB_GIF_BY_ID`.

Buying licensed clips is researched in `.lavish/torq-gif-quality.html`:
cheapest credible option is Exercise Animatic (~2000 4K clips, $270),
best-looking is MoveKit (412 clips, one consistent 3D style, EUR 219). The
correction that matters there: you do NOT need 1500 clips. 15 unique dbIds
in `recommended.ts` and 30 in `plan.ts` drive every generated plan, so buy
the head and keep a text-only fallback for the tail.

## Screens (`src/screens/`, tabs in `src/components/BottomNav.tsx`)

FIVE dock tabs plus the profile slot: Home (default) · Workout · History ·
Ranks · Stats, then "You": the user's AVATAR, which opens Profile as a
full-screen overlay rather than switching tabs (the floating top bar was
REMOVED 2026-08-06; TOP_BAR_SPACE is 0). Exercises is the only screen left
outside the dock: it is a SUB-PAGE of Workout, opened from that tab's
"Exercise library" row, and keeps its parent tab lit while open. Home's
"Recent workouts · See all" still jumps to History as a shortcut. Stats (tab id "stats", ChartColumn icon, titled "Progress")
is the STRENGTH page, not the workload page (2026-08-09): rank points now +
the climb (RankLine with tier bands), tier progress in points and kilos,
the dumbbell "what moved" chart, the records feed, then bodyweight and
streak. Volume/sets/hours/weekly bars/muscle split live in its "Training
load" sub-page and measurements in a "Measurements" sub-page. Home is "TODAY, FULL-BLEED" (2026-08-09): weekday headline + date + streak
pill + calendar button, then the TodayHero as a PANEL THAT CHANGES SHAPE,
training day = lime gradient + border, session name, muscle chips, sets and
minutes, big Start; rest day = grey surface, moon, "Recovering", what is
recovering and how long since, a NEXT UP block and only a ghost "Train
anyway"; plus done / live-session / no-plan faces. Then the WEEK STRIP,
which now carries each day's SESSION TAG (PUSH / PULL / LEG), three stat
TILES (rank + weekly delta, streak + week dots, kg to the next tier), a
tappable rank-shield row into Ranks, and the day-aware workout list.
The DateRuler and the volume Sparkline are GONE. See the History note
below. Calories are NOT shown on Home (removed 2026-08-06; still on
WorkoutCard/summary/Stats). The Workout tab is
quick-start + the user's routines + a
"Recommended" section (3-card push/pull/legs split from
`src/lib/recommended.ts`, exercises referenced by ExerciseDB `dbId`), and
becomes the live set-logger while a session is active (`activeWorkout` in
the store). `startRecommended` in the store imports any missing catalog
exercises into the library, then opens a session with sets prefilled at the
template's target reps.

## Building (EAS)

Adilzhan builds with **EAS**, not locally: `eas build -p android --profile
preview` produces an installable APK (`android.buildType: apk` on the
development/preview profiles; production stays an AAB for Play).

CRITICAL GOTCHA, and the cause of "I can't create an account": **`.env` is
gitignored, so EAS never uploads it.** A build with no
`EXPO_PUBLIC_SUPABASE_*` has `supabaseConfigured() === false`, which made
the auth gate silently skip itself and left Friends dead. The values now
live in each build profile's `env` block in `eas.json`, safe to commit,
since `EXPO_PUBLIC_*` is inlined into every APK anyway and the publishable
key is public by design (RLS is the protection). `.env` stays for local
Metro. Change a key → change it in BOTH places.

The app now fails loudly instead: with sync unconfigured, an amber banner
sits at the top of the screen and explains the fix when tapped. If you ever
see it in a real build, fix eas.json, not the app.

## Auth + secrets

`.env` (gitignored, chmod 600) holds the Supabase config; `.env.example` is
the committed template. Two CLASSES of value live there and must not be
confused:

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  Expo INLINES every `EXPO_PUBLIC_*` into the app bundle, so these are
  public by definition. That is fine: the publishable key can do nothing on
  its own, RLS is what protects the data. Verified by grepping the exported
  Hermes bundle.
- `SUPABASE_DB_URL`: the Postgres superuser connection, for running
  `supabase/*.sql` from a terminal. NEVER prefix it `EXPO_PUBLIC_` and
  never reference it from `src/`, or the app would ship DB credentials.

  It must be the **session pooler** host, not `db.<ref>.supabase.co`:
  the direct host is IPv6-ONLY and this machine has no IPv6 route, so psql
  dies with "Network is unreachable" before authenticating. The pooler is
  IPv4 and free. Shape (project region resolved 2026-08-09 by probing, since
  it is not in any local file):
  `postgresql://postgres.<ref>:<pw>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require`
  Port 5432 = session mode (DDL + transactions work); 6543 = transaction
  mode, which cannot run migrations. So migrations ARE runnable from here:
  `psql "$SUPABASE_DB_URL" -f supabase/social.sql`.

GOTCHA: Metro caches the bundle, and `.env` values are baked in at bundle
time, after editing `.env` you must restart Metro with `--clear` (an
`expo export` without it happily reuses a bundle that still has the old
values, which is exactly how a "the key isn't loading" hour gets spent).

The auth gate (`src/screens/Auth.tsx`) is the first screen on a cold start
when sync is configured and nobody is signed in: spinning vortex
(`SpinningLogo` in Logo.tsx), Sign in / Create account switch, email +
password + confirm, no OTP (Adilzhan's call, 2026-08-08). The password
policy lives in `src/lib/password.ts` (≥10 chars, mixed case, digit,
symbol, plus a banned/sequential/repeated/contains-your-email check) and is
shown as a LIVE checklist and 4-segment meter while typing; submit is
disabled until the form can actually succeed. This project has
`mailer_autoconfirm: false`, so sign-up returns no session and the screen
switches to a "Confirm your email" state.

torq is local-first, so the gate always offers **Continue without an
account**, it persists as `torq.guest.v1` in AsyncStorage
(`useAuth().guest`), Profile's Account section turns into a "Sign in or
create an account" button that calls `exitGuest()`, and signing out clears
the flag so the gate returns. Profile no longer contains a sign-in form:
one screen validates passwords.

## Rank badge (hex track, 2026-09-04)

`src/components/RankBadge.tsx` is the badge Adilzhan picked from the
artifact "Torq Badge Ladder" after three rivals were drawn against it
(Loaded Bar, Momentum, Cut Stone; a Loaded Bar second pass was built and
then dropped). Kept: the vortex emblem, the nine tier metals, the rounded
hexagon. Changed:

- **Stage is a TRACK, not an orbit.** A thin hexagon outside the frame
  lights `stage / 4` of its perimeter clockwise from the top, one gem at
  the lit tip, stage IV closes the loop with the gem at the crown. The old
  tilted ellipse with balls is gone.
- **Tier earns DETAIL, one per step, cumulative**, from the `DETAIL` table:
  Iron bevel, Silver gloss, Gold corner studs, Platinum halo, Diamond
  facets + glints, Elite eight rays (one per vortex blade) + glow, World
  Class holographic frame + sheen. Each flag has a `minSize`, so a 34 px
  feed badge is frame + emblem + track + gem. Tune a tier by editing the
  table, not the render.
- Emblem is `EMBLEM_W = 72` on `R = 50` (1.44 x R). Adilzhan first asked
  for a touch smaller than the artifact, then for bigger once it was on the
  phone; 72 fills the field and still clears the inner frame.
- **One row size, `BADGE_ROW = 96`**, used by Home's rank row, Profile's
  rank strip and best lifts, and the Ranks lift rows. Before it was
  46 / 62 / 64 / 68 and read as small and inconsistent page to page. The
  Ranks hero (TierCarousel) and ExerciseInfo's 190 stay their own size.
- **Animated by default** (`animated = true`): gem glides on the native
  driver via sampled hex-polyline tables, rays rotate and glints twinkle
  as native Animated.Views, on every badge on every page. The static path
  still exists; ShareCard passes `animated={false}` because it captures the
  view as an image. The World Class sheen is the ONE JS-driven animation
  (a Rect `x` under an SVG mask), on one badge at a time.
- ViewBox is 200 x 160, the same 0.8 aspect as before, exported as
  `BADGE_ASPECT`; no caller layout moved.

App.tsx now ignores the offline-fetch LogBox patterns
(`UnknownHostException`, `AuthRetryableFetchError`, `fetch failed`): a
failed background call to Supabase is a normal state for a local-first
app, and the dev toast sat over the dock and swallowed every tap.

## Percentiles + plausibility

`src/data/percentiles.json` (2 KB, committed) holds DOTS-point
distributions per sex per competition lift, built by
`scripts/build-percentiles.py` from the OpenPowerlifting dump (168 MB zip,
NOT committed: re-download when refreshing). 2026-08-08 build: 4.0M meet
results → 1.46M per-lifter-per-lift bests, raw only, best result per
LIFTER. The per-lift n runs 133,697 (female squat) to 401,158 (male bench);
distinct lifters is lower still, since one lifter feeds up to three curves.
NEVER say "2.2 million", that figure was wrong in four places and shipped in
the paywall copy until 2026-08-17.
Distributions are over POINTS rather than kilos because DOTS already
normalizes sex and bodyweight, so one curve per (sex, lift) serves every
weight class. `src/lib/percentile.ts` interpolates between the stored
breakpoints and returns 1-99 (clamped at the tails).

NEVER phrase these as "top N% of people". The population is people who
entered a sanctioned meet (a much stronger crowd than the gym floor), so
every surface says "of competitive lifters" and names the sample size.

`src/lib/plausibility.ts` gates what LEAVES the device: a lift above the
world record for the user's class (or over `MAX_DOTS` = 200 for movements
with no official record) is dropped from the published snapshot and from
the overall points. It is not dropped from the user's own logs, charts or
Ranks screen: the cap is about what other people are shown, and in
practice it catches decimal-point typos far more often than cheats. The
exercise Rank tab shows the reason inline when a lift is gated.

## Social (PATH.md Phase 3)

`supabase/social.sql` is the SECOND schema file (run it in the SQL editor
like schema.sql; re-running is safe). It is deliberately separate from the
private mirror tables: those hold raw logs and never leave their owner.

- `profiles`, user_id, unique citext `handle` (3-20 of `[a-z0-9_]`),
  display_name, `visible` (opt-in, default false).
- `friendships`, requester/addressee/status (pending·accepted·blocked),
  unique on the ordered pair. RLS splits the verbs on purpose: you INSERT
  only rows where you are the requester, UPDATE only rows addressed TO you
  (so nobody accepts on your behalf), DELETE any row you are part of
  (decline = cancel = unfriend = "remove the edge").
- `rank_snapshots`, the published half of the rank engine: points, tier,
  stage, top-5 lifts as jsonb. Readable by you and accepted friends via the
  SECURITY DEFINER `are_friends()` helper.
- `rank_events`, one row per TIER change, the friends' feed. Same friend
  scoping; insert/delete own, and NO update policy at all (an event is a
  fact about a moment, so it can be created or removed but never rewritten).
  `publishRankFromData()` writes them by diffing the stored snapshot against
  the freshly computed rank: PROMOTIONS ONLY (a tier can fall when
  bodyweight rises, "reached Silver" would be a lie on the way down),
  nothing at all on a first publish, and idempotent because the diff is
  against the stored row, so republishing on every workout and every Friends
  open cannot duplicate an event.
- `find_profile(handle)` / `handle_taken(handle)` / `search_profiles(query)`
, SECURITY DEFINER RPCs, execute granted to `authenticated` only.
  `search_profiles` (2026-08-08) does prefix/substring matching on handle
  and display name, bounded on purpose: `visible` profiles only, 2-character
  minimum, 20-row cap, and it returns only handle + display name. Backed by
  pg_trgm GIN indexes so it does not degrade into a sequential scan.

`src/lib/social.ts` wraps all of it, every call returning
`{ data, error }` with an already-friendly message. `publishRankFromData()`
computes the rank locally and upserts the snapshot; it runs after every
`finishWorkout()` (fire-and-forget, signed out and offline are normal) and
whenever the Friends view opens. `sendRequest()` handles the crossing case:
if they already asked you, adding them back accepts instead of creating a
second edge in the opposite direction.

`src/screens/Friends.tsx` renders inside the Ranks tab behind a You/Friends
switch, with three states: guest → offer the account; no profile → claim a
handle (the opt-in); otherwise incoming requests, add-by-handle, friends
sorted by points (badge · name · @handle · top lift · pts; tap to compare,
hold to remove), then outgoing requests. It owns its OWN ScrollView and
Ranks renders it OUTSIDE the You-view ScrollView, an absolute overlay
inside a ScrollView positions against the scroll content, not the window,
so the compare and confirm overlays would scroll away otherwise.

`src/components/FriendCompare.tsx` is the head-to-head: two badge columns,
the points lead, and a lift-by-lift table keyed on a name slug. It compares
DOTS POINTS, not kilos: comparing raw weight between a 60 kg and a 95 kg
lifter would undo the normalization the whole app is built on. A friend's
snapshot only carries their top 5, so a blank cell means "not in their top
five", which the caption says out loud.

`src/components/ShareCard.tsx` turns things into 4:5 story images:
`ShareSheet` is the overlay + capture + system share sheet, and each card
FACE is a child of it (`ShareRankCard`, `ShareWorkoutCard`, add faces, not
capture code). The mechanism:
react-native-view-shot `captureRef` + `expo-sharing` (both in Expo Go,
checked against the SDK 57 docs). The card is the VISIBLE overlay, not an
off-screen view, off-screen views can capture blank on Android, and the
user should see what they are about to post. captureRef sizes in logical
points, so the 1080×1350 output comes from dividing by `PixelRatio.get()`
(the trick the Expo docs spell out). `expo-sharing`'s config plugin got
auto-added to app.json by `npx expo install`; it is a no-op here (its
options default to disabled) because we only SEND shares.

## Writing rule: no em dashes

The user's global CLAUDE.md now opens with this rule, and it applies to
everything written here too: **never output ", " or "–"**, in prose, code
comments, docs, commit messages or text baked into generated images. Use a
comma, a full stop, a colon, parentheses, or a plain "-" when a dash is
genuinely right. Em dashes read as AI-written text and the user does not want
their work to look generated.

The whole repo is clean as of 2026-08-10: 1,144 em dashes were replaced
across every tracked file. A grep for the character should only ever find
the two notes below that name it. Check before committing prose.

## Diagrams: RULE FOR EVERY LAVISH ARTIFACT

Adilzhan liked the flow graph under "How the entity evolves over three years"
in `.lavish/torq-company-plan.html` and asked for that kind of drawing every
time. So: **any flow, state machine, architecture, sequence or decision tree
in a lavish page is a MERMAID graph in a `.mermaid` container**, never
hand-built divs and arrows, never an ASCII box drawing, and never a paragraph
describing a flow that could be drawn.

The look is not mermaid's default. It is themed to the app palette, and this
init block is the one to copy (it is what that page uses):

```js
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.esm.min.mjs";
mermaid.initialize({
  startOnLoad: true, theme: "base", securityLevel: "strict",
  fontFamily: "Space Grotesk, system-ui, sans-serif",
  themeVariables: {
    background: "#151714", primaryColor: "#151714",
    primaryTextColor: "#F2F4EE", primaryBorderColor: "#C8FE23",
    lineColor: "#5C6356", secondaryColor: "#1B1E1A",
    tertiaryColor: "#1B1E1A", mainBkg: "#151714", nodeBorder: "#262A24",
    clusterBkg: "#1B1E1A", edgeLabelBackground: "#0E0F0E",
    textColor: "#9AA294",
  },
});
```

with `.mermaid{background:var(--surface);border:1px solid var(--line);
border-radius:var(--md);padding:22px 14px;text-align:center;overflow-x:auto}`
and `.mermaid svg{max-width:100%;height:auto}`.

What makes those graphs readable, and what to repeat:

- **Nodes carry their own facts.** `<b>UG</b><br/>Limited liability, 1 EUR
  capital<br/>Setup: ~500 EUR` says the whole thing in the box. A node
  labelled just "UG" pushes the reader back into the prose.
- **Edges are the TRIGGER, not the verb.** "MRR > 1,500 EUR or first employee"
  beats "then". The whole point of the picture is what advances a step.
- **Per-node `style` lines**, lime border (`#C8FE23`) for the live path,
  `#262A24` for inert or past states, purple (`#9C86E8`) for an outcome.
  Dotted edges (`-.->`) for the optional or do-nothing branch.
- **A dense table right under the graph** with the same steps as rows. The
  graph gives the shape, the table gives the numbers; neither does both well.
- HTML entities in labels (`&gt;`, `&auml;`), since the page is HTML.

This is the `lavish` skill (its `diagram` playbook), NOT `dataviz`. Reach for
`dataviz` only when actual DATA is being plotted (bars, lines, distributions,
a dashboard). Shapes and relationships are mermaid.

## Screenshots + the README product page

**The README is a product page, and its artwork is GENERATED. Never hand-make
it, and never let it go stale.** When a feature changes a screen that appears
there, re-shoot that one screen and rebuild. The layout is code.

```bash
./run_android.sh torq2      # emulator + Metro
./scripts/snap.sh home      # one screenshot -> docs/shots/home.png
./scripts/build-shots.py    # -> docs/shots/framed/* and hero.png
```

- `scripts/snap.sh <name>` grabs the emulator and crops `1080x2232+0+120`,
  which removes exactly the Android status bar (40 dp) and the gesture pill
  (16 dp) at 3x while KEEPING the dock: the dock is the product, the status
  bar is not. Different density or a notch means re-measuring, not nudging.
- `scripts/build-shots.py` rounds/bezels/shadows every shot into
  `docs/shots/framed/` and composes the 2600x1400 `hero.png` (wordmark in the
  real Space Grotesk from node_modules, the vortex dimmed to 6% bleeding off
  the corner, three phones with Home in front). It is deterministic,
  re-running it reproduces the committed PNGs pixel for pixel.
- **`docs/shots/HOW.md` is the operating manual**: the shot list (what each
  screenshot must show), how to STAGE the app before shooting (seed the demo
  history, have a plan, no live session before the Home shot, dismiss the IME
  toolbar with keyevent 111), and what to do if the device changes. Read it
  before refreshing anything.

Two traps, both hit while building this:

- An ImageMagick mask drawn on `xc:none` with no `-fill` uses the DEFAULT
  fill, which is BLACK. As a CopyOpacity source that makes the whole image
  transparent, so you composite an empty bezel and cannot see why. The mask
  must be `xc:black -fill white`.
- Every claim in the README was checked against the code, and two were wrong
  from memory: the tier ladder starts at **Rust** (Rust → Iron → Bronze →
  Silver → Gold → Platinum → Diamond → Elite → World Class, no "Master"), and
  the percentile sample is up to 401k **lifters per lift**, not 2.2M and
  not results. The README also
  repeats the percentile rule, never "top N% of people", always "of
  competitive lifters".

## Modals: RULE FOR EVERY OVERLAY

**Every overlay in the app goes through `src/components/CustomModal.tsx`.**
There is exactly one implementation and a test enforces it
(`src/lib/__tests__/motion.test.ts` fails if a second file imports
react-native's `Modal`, paints its own `rgba(0,0,0,…)` scrim, or springs on
the old ringing config).

- `CustomModal`: centered dialog (menus, confirms, editors, pickers).
- `ConfirmModal`: the ready-made confirmation. `tone="danger"` (default)
  paints the confirm red for deletes and discards; `tone="accent"` paints it
  lime for a commit such as Finish workout. Both live-session exits
  (Finish, Discard) go through it since 2026-09-04, and the message says what
  is kept and what is lost (unticked sets are dropped on finish).
- `AnchoredModal`: popover pinned under the button that opened it. The
  CALLER still positions it (`style`), in WINDOW coordinates, because the
  four call sites anchor differently; the shell owns the wrapper, the
  tap-outside close, `statusBarTranslucent` and the animation.
- `ModalBackdrop`: the dim on its own, for sheets that bring their own body.
- `MenuRow`: icon + label row for menus.
- `useModalClose()`, animated close for a child. GOTCHA: it reads a context
  the modal PROVIDES, so calling it in the component that RENDERS the modal
  is outside the provider and silently returns a no-op. Put closing buttons
  in their own child component (ConfirmButtons is the pattern).

Timing lives in `MOTION` (`src/lib/motion.ts`, re-exported by theme.ts),
150 ms in, 110 ms out, scale 0.96 → 1. Do not hand-write an overlay duration.

Centered shells are inline absolute overlays, NOT react-native Modals (those
clip on this emulator), so mount them inside a flex-1 screen root. They sit
UNDER the dock, which is long-standing behaviour. `AnchoredModal` is the one
exception that uses a real Modal. See the history entry for why that costs
~47 ms and is kept anyway.

## Keyboard: RULE FOR EVERY NEW INPUT

**Any screen or overlay that gains a `TextInput` must keep that input
visible when the keyboard opens.** Adilzhan hit this on the device: tapping
a field near the bottom put the keyboard right on top of it, so he couldn't
see what he was typing. Do not add a bare `ScrollView` around an input
again.

- **Scrollable screen** → use `KeyboardAwareScrollView` from
  `src/components/KeyboardAware.tsx` instead of `ScrollView`. Drop-in, same
  props; pass `bottomOffset` when a pinned footer sits under the fields.
- **Bottom-anchored sheet / absolutely-positioned panel** (no scroll to
  give) → take `useKeyboardHeight()` from the same file and set
  `bottom: keyboard`, so the whole panel rides above the keys. See the
  new-exercise sheet in `ExerciseBrowser.tsx`.
- **Centred dialog** → nothing to do, it is already above the keyboard.

Why it is hand-rolled: `react-native-keyboard-controller` is the polished
answer but is NOT in Expo Go (SDK 57 keyboard guide), and adopting it would
cost the `run_android.sh` emulator loop. The implementation is deliberately
MEASUREMENT-based rather than layout-based: Android under edge-to-edge may
resize the window, pan it, or do neither depending on version, so instead of
assuming, it measures where the focused input actually landed once the
keyboard is up and scrolls only if it is genuinely covered. If the OS
already handled it, the correction is zero and nothing fights anything.

## The streak creature

The streak has ONE character now, in two forms, and they come from the same
file:

- `assets/Streak.json` is the designed Lottie Adilzhan installed. It plays in
  the celebration modal (`StreakDialog`), where a five second loop is the
  point.
- `assets/streak-creature.svg` and `src/components/StreakCreature.tsx` are
  the STILL, lifted out of that Lottie as real vector, shown next to the day
  count on Home where a loop would be noise.

If the animation is ever replaced, re-run both scripts:

```bash
./scripts/recolor-lottie.py assets/Streak.json --list          # see its palette
./scripts/recolor-lottie.py assets/Streak.json --map CCFF00=C8FE23
./scripts/lottie-to-svg.py assets/Streak.json --flat --out assets/streak-creature.svg
```

Then regenerate the component's paths from that SVG (six paths: four lime
body, two black eyes) and re-measure the tight viewBox by rasterising at
2048 px and trimming.

- **Recolour the FILE, do not tint at runtime.** `lottie-react-native`'s
  `colorFilters` matches on keypaths, which depend on the layer names inside
  the file; packs name their groups "Group 3" and the behaviour differs by
  platform. Editing the JSON is exact and free. A second colourway (amber for
  an at-risk streak) is another `--map` and another small file, which still
  beats keypath plumbing.
- **GOTCHA in the SVG extraction: Lottie paints its shape list in REVERSE.**
  The first shape in the list is on top; in SVG the last element wins.
  Emitting the list in order buried the creature's eyes under its body, and
  the first render came out blank-faced. `scripts/lottie-to-svg.py` reverses
  every list and sets `fill="none"` at the root, because a Lottie path with
  no fill in its group paints nothing where an SVG path would default to
  black.

`StreakMark.tsx` and `assets/flame.json`, the two earlier flames, are
DELETED. The whole point is that the modal and the header show the same
creature, which neither of them managed.

## Sound

`assets/sounds/*.m4a` are SYNTHESIZED by `scripts/build-sounds.sh` (ffmpeg,
plucked sine tones in A minor pentatonic, ~3-14 KB each), not sampled from a
stock library. Reasons, in order: no licence to honour in a paid app, tiny
files, and they actually match the design, dark and sharp rather than the
cinematic whoosh every free SFX pack is full of. Pitch rises with
significance: rest tick (A4, quietest, it repeats) < set done (E5+A5 blip)
< go (A5+E6) < workout done (A4-C5-E5-A5 run) < PR (E5-G5-C6-E6). Tweak a
number in the script and re-run it; don't hand-edit the m4a.

`src/lib/sounds.ts` (expo-audio, in Expo Go) enforces two rules:
NEVER interrupt the user's music: the audio mode is `mixWithOthers` with
`playsInSilentMode`, because people lift to Spotify and an app that pauses
it to go "ding" gets uninstalled, and players are created ONCE and reused
(one per set would leak native players across a long session). `play()`
never throws and is silent when muted; audio is a garnish, not something
logging a set can fail on. Wired to: ticking a set, the 3-2-1 rest
countdown + "go" at zero, and finishing (the PR flourish when the session
set records, otherwise the plain one). `Settings.sound` toggles it in
Profile; undefined counts as ON so existing installs get sound.

## Push notifications

Client: `src/lib/notifications.ts`. Server: `supabase/functions/notify`
(Deno Edge Function) fanning out on inserts into `friendships` and
`rank_events`, driven by Database Webhooks. Tokens live in `push_tokens`,
one row per DEVICE keyed on the token itself.

Things that are decisions, not accidents:
- **NEVER import `expo-notifications` at module scope.** `notifications.ts`
  loads it with a dynamic `import()` behind `pushSupported()`, and that is
  not style. It is the fix for a total app failure. The package's
  `index.js` re-exports `DevicePushTokenAutoRegistration.fx`, which calls
  `addPushTokenListener()` AT MODULE SCOPE, and that helper THROWS in Expo
  Go on Android (remote push was removed in SDK 53). A throw during require
  takes the whole bundle down, so the app showed a red "[runtime not ready]"
  box and never rendered a frame, and the `pushSupported()` guards were
  useless, because the crash happened at import time before any of our code
  ran. Found on the emulator 2026-08-09; it had been broken since push
  landed. `primePush()` (called from App.tsx) warms the module and installs
  the foreground handler in real builds, and is a no-op in Expo Go.
- Remote push is DEAD in Expo Go from SDK 53. `pushSupported()` (now
  `!isRunningInExpoGo()`) detects that and every function no-ops, so
  `run_android.sh` still works. It just won't deliver pushes. Testing push
  needs a dev/preview build.
- Permission is requested when the user opens **Friends**, not at launch.
  The OS prompt appears once; shown out of context it gets denied forever.
- `unregisterPush()` runs on sign-out. A token left behind would deliver the
  next person's friend requests to the previous owner's phone.
- The Edge Function uses the SERVICE ROLE key to read recipients' tokens
  (their RLS correctly forbids everyone else). That key must never appear in
  the app bundle, which is exactly why the decision to notify lives server
  side, quite apart from the fact that a closed phone can't notice anything.
- `tsconfig.json` now EXCLUDES `supabase/functions`: it's Deno, with URL
  imports and different globals, and `npm run tsc` would fail on it.

Setup steps only Adilzhan can do (FCM credentials, deploy, webhooks) are in
`supabase/functions/notify/README.md`.

## Entitlements / paywall

`src/lib/entitlements.ts` is the ONLY place that decides what is paid. The
split lives in the `FEATURES` table as data. The point is that changing the
business model is one edit, not an audit of `if (isPro)` scattered through
the app. Screens ask `can("ranks")` and render `LockedPanel`/`Paywall` from
`src/components/Paywall.tsx`.

TWO RULES that are not arbitrary:
- `cloudSync` is free forever. Holding someone's training history hostage
  behind a subscription is not a business model.
- `BILLING_UNAVAILABLE_SO_EVERYTHING_IS_FREE = true` until Play Billing is
  actually connected. Shipping a paywall over features nobody can buy would
  break the app for its only user. `unlock()` is the single seam: run the
  purchase, verify server-side, call `setPro(true)`.

Profile's Developer card has a Pro ON/OFF toggle so the locked states can be
exercised before billing exists.

## The Arena (global leaderboards)

`src/screens/Arena.tsx`, third segment of the Ranks tab. Backed by
`arena_top(lift, verifiedOnly, limit)` and `arena_my_rank(lift)` in
supabase/social.sql, over `rank_snapshots` joined to profiles that opted in.

The design is defensive on purpose (PATH.md's "Liftoff lesson"):
- `profiles.arena` is a SEPARATE opt-in from `visible`. Having a public
  profile must never silently enter someone into a global ranking.
- Ranked on DOTS points, not kilos: a global board mixing bodyweights is
  only fair because of the normalization.
- `profiles.verified` exists but NOTHING sets it yet; the "Verified lifters
  only" filter ships anyway so tightening trust later is a data change, not
  a UI retrofit.
- The board exposes exactly what search already does: handle + display name.
  No bodyweight, no logs, no user ids.
- The footer says entries are self-reported and points at the friends board
  as the trustworthy one. Do not remove that.

## Account deletion + export (Play requirement)

Google Play REQUIRES in-app account deletion from any app that offers
account creation, so this is a launch blocker, not a nicety. Profile's
"Your data" section holds both, export first on purpose: deleting must
never be the only way out, and someone about to wipe their account should
see how to keep their history first.

- `delete_my_account()` in supabase/social.sql, SECURITY DEFINER because it
  must reach `auth.users`, which no client role can touch. It takes NO
  parameter and only ever deletes `auth.uid()`'s rows, which is what makes
  granting it to `authenticated` safe. Everything cascades from auth.users
  anyway; the explicit deletes are belt-and-braces for tables added later
  without a cascade.
- `deleteAccount()` in social.ts, then `wipeLocalData()`, BOTH are
  required. Deleting only the cloud copy would leave the phone's history to
  re-upload itself on the next sign-up, so the "deleted" account would come
  back.
- `exportData()` (`src/lib/exportData.ts`) writes the whole DB as JSON and
  opens the share sheet. Uses the SDK 57 `File`/`Paths` API, the old
  `FileSystem.cacheDirectory` + `writeAsStringAsync` moved to
  `expo-file-system/legacy` in this version.
- With no account, the destructive button becomes "Erase all data on this
  phone" and says plainly that there is no cloud copy to restore from.

## Failure handling

`src/components/ErrorBoundary.tsx` wraps the app twice: once PER TAB (keyed
by tab, so a crash in Stats leaves the dock alive and the user can walk to
another tab instead of force-quitting) and once around the whole tree for
crashes outside a tab (onboarding, the auth gate, providers). The recovery
screen NEVER touches storage, every option re-renders or navigates. A bug
in a chart must not be able to take a year of workouts with it. Reset works
by bumping a key so the subtree remounts; without that React reuses the same
instances and rethrows immediately.

`loadDB()` used to swallow a JSON parse failure and return an empty DB.
That was silent data loss: the app looked like a fresh install and the next
save overwrote the user's real history. It now parks the unreadable blob
under `BACKUP_KEY` and sets a failure flag that the store exposes as
`loadError`, which App.tsx surfaces as a red banner BEFORE the user can log
a session on top of it. A missing key is still treated as a genuinely new
install, only an unparseable one is an error.

## Tests

`npm test` (vitest, `src/lib/__tests__/`). 243 tests in 21 files over the PURE
logic: rank/DOTS, percentiles, plausibility, records matching, password
policy, streaks, weight progression, plan generation, calories, PRs. No
component tests: the libs are where the product's claims live, and they
import no React Native, so vitest runs them directly with no RN harness.

Two things this bought immediately:
- It caught a REAL bug on the first run: `MAX_DOTS` was 200 on the
  assumption that elite single lifts score 130-140 DOTS. They don't. DOTS
  is calibrated for a three-lift TOTAL, so a world-record single scores
  ~270, and the cap would have silently refused to publish real elite lifts.
- The `plan.test.ts` sweep (4 goals x every 2-6 day subset x focus combos,
  1000+ combinations) is the regression net for the generator; that shape of
  check is what caught flat 5x5 producing two-hour sessions.

Run it before every commit; `npm run tsc` only proves types, not behaviour.
Note both data modules now use `import x from "*.json"` rather than
`require()`, Metro supports both, but vitest is ESM and `require` is not
defined there.

## Launch docs

`docs/launch/` holds the Play release pack: `PRIVACY.md`, `DATA_SAFETY.md`,
`STORE_LISTING.md`, `LAUNCH.md`.

`DATA_SAFETY.md` was written against the real schema, not from memory,
Google audits Data Safety answers against observed network traffic and pulls
releases that misdeclare. Two things there are easy to get wrong and are
called out in the file: bodyweight/sex ARE collected (the rank engine
normalizes on them) even though other users never see them, and publishing a
rank to another torq user is NOT third-party "sharing" under Play's
definition. Re-check the whole sheet when analytics, billing or regional
boards land.

## Play compliance: the open blockers (audited 2026-08-17)

Four parallel audits went over the app before the first Play submission.
Most findings were fixed the same day (see `docs/HISTORY.md`). **Three
blockers remain and they need Adilzhan's decision, not code.**

1. **ExerciseDB data has no licence grant.** `src/lib/exercisedb.ts` calls
   it "the full open-source dataset". That is not supported by anything.
   The upstream repo is AGPL-3.0 "Copyright (C) 2025 AscendAPI" and covers
   the API CODE; it contains no dataset and states no data licence. The
   vendor's paid tier explicitly sells the right to "bundle them in your
   app", which is the right torq exercises without having bought it. The
   sharp edge is `exercisedb-instructions.json`: 776 KB of authored prose,
   which unlike the factual fields is plainly copyrightable. Options: buy
   the licence, get written permission and archive it, or write our own
   instructions for the ~45 dbIds `recommended.ts` and `plan.ts` actually
   use and drop the file.
2. **`assets/Streak.json` provenance is unknown, and it SHIPS.**
   `StreakDialog.tsx:83` requires it, and `streak-creature.svg` derives
   from it for Home. Metadata says `@lottiefiles/creator 1.86.1`, and
   `Streak.lottie`'s INTERNAL zip timestamps are 2026-04-14, four months
   before every other streak file, so it was packaged by someone else and
   downloaded. Recolouring and vectorising it made a derivative, not a new
   copyright. LottieFiles free-tier terms frequently forbid use in a
   product sold to end users. Find the source URL and read its licence tab,
   or regenerate the creature from scratch (`scripts/gen-bench-press.py`
   proves it is doable, and six paths is far simpler than a bench press).
3. **No report and no block mechanism for user content.** Play's UGC policy
   requires both. `display_name` is free text with no validation
   (`social.ts:193`), avatars are user-uploaded images, and
   `search_profiles` surfaces both to strangers. `friendships.status =
   'blocked'` is READ in two places and written by nothing. `removeEdge`
   deletes the row, so the same account can re-request immediately. Needed:
   a Report action writing to a `reports` table, a real Block honoured by
   `sendRequest` and `search_profiles`, and a server-side display-name
   constraint.

Note that (3) and much of the avatar risk exist only because of avatar
upload, a feature this file never documented. Deleting avatars collapses
most of that surface; initials on a coloured circle cost nothing visually.

Two things fixed here that must not regress:
- `snapshotsByIds` lists snapshot columns ONE BY ONE, and
  `supabase/social.sql` revokes SELECT on `bodyweight_kg`/`sex` at the
  COLUMN level. RLS alone cannot say "a friend may read this row but not
  these two columns", and a `select("*")` would put someone's bodyweight on
  their friend's phone. Nothing needs to read them back.
- `app.json` sets `cameraPermission: false` and `microphonePermission:
  false` on expo-image-picker. Without them the plugin ships CAMERA and
  RECORD_AUDIO on a workout tracker, neither of which any code calls.

## Commands

- `./run_android.sh [avd]`, one-shot run: boots the named AVD (default
  `torq`) if needed, pins all adb/expo work to that emulator's serial via
  `ANDROID_SERIAL` (safe while other emulators run other projects), keeps
  Expo Go IN SYNC with the SDK's required version (queries Expo's versions
  API, installs from/downloads to `~/.expo/android-apk-cache` on mismatch,
  Adilzhan's other project keeps downgrading Go on the shared `torq` AVD,
  which broke launches with "Project is incompatible with this version of
  Expo Go"), REUSES an already-running Metro of this repo (matched by
  process cwd) instead of stacking duplicates, else auto-picks the first
  free port and opens `exp://10.0.2.2:<port>`. Preferred way to run the
  app.
- `npm start` / `npm run android`: dev server
- `npm run tsc`: typecheck (keep this clean)
- `CI=1 npx expo export --platform android`: verify the bundle compiles

## Dev environment (this machine)

Android tooling lives user-locally (no root): JDK 21 at `~/.local/jdk`,
Android SDK at `~/Android/Sdk` (platform-tools, emulator, android-36 image).
AVDs `torq` and `torq2` (both Pixel 7, hw.keyboard=yes) are at
`~/.config/.android/avd`, the emulator only finds them with
`ANDROID_AVD_HOME=~/.config/.android/avd` exported. `torq2` exists so Torq
can run beside Adilzhan's other project (which occupies `torq`/8081):
`./run_android.sh torq2`. Used in anger 2026-08-09, with Claude Code open
on the grit repo too, Expo Go on the shared `torq` AVD kept reopening THAT
project, so torq moved to `torq2` (emulator-5556) while grit kept
emulator-5554. The script boots the AVD, syncs Expo Go to the SDK's required
version, reuses this repo's existing Metro instead of stacking a second one,
and pins ANDROID_SERIAL, so the two sessions never fight. Always export
ANDROID_SERIAL for adb calls when both are up. Launch:
`ANDROID_AVD_HOME=~/.config/.android/avd ~/Android/Sdk/emulator/emulator -avd
torq -gpu host`, then `npx expo start --android` (Expo Go).

## History

**The full dated changelog lives in `docs/HISTORY.md`.** It was moved out of
this file on 2026-08-17 because CLAUDE.md had grown to 158k characters against
a 150k context limit. Nothing was deleted, only relocated: every entry, every
gotcha and every "why we rejected the other option" is still there, in date
order. Read it when you need the reasoning behind a decision the sections
above only state. Keep appending new entries THERE, not here, and keep the
sections above current instead, they are the part that has to be in context.

The short version of how the project got here:

- **2026-07-04 to 07-11:** built. Expo + NativeWind scaffold, grit's design
  system and Supabase sync ported, the 1500-exercise ExerciseDB catalog,
  Strong-style live session (rest timers, set types, PREVIOUS column, swipe
  to delete, warm-up ramps, notes), routines + editor, workout summary with
  PRs, charts, the training-plan generator and onboarding wizard, suggested
  next weights, plan-aware streaks, calories.
- **2026-08-04 to 08-06:** the rebrand. Space Grotesk, the lime vortex logo,
  the near-black CARDLESS palette, the rank engine (DOTS + a 9-tier ladder)
  and the Ranks tab with SVG shield badges.
- **2026-08-08:** the heavy day. SHARP-10 radii, the auth gate, the whole
  social layer (profiles, friends, snapshots, compare, share cards),
  OpenPowerlifting percentiles + plausibility caps, the Arena, entitlements,
  push notifications, account deletion and export, error boundaries, the
  vitest suite, and a measured startup/search performance pass.
- **2026-08-09:** Tabler icons (and the barrel-import discovery that cut
  1.78 MB off the bundle), a measured tab-switch performance pass, one
  PageTitle everywhere, the five-slot dock, and Home / Stats / History /
  Profile each rebuilt from a lavish review.
- **2026-08-10 to 08-11:** 1,144 em dashes removed, the README rebuilt as a
  generated product page with a repeatable screenshot pipeline, every overlay
  moved onto one modal shell with measured timing, and the FEATURES.md top
  five shipped (ghost mode, per-set timestamps, auto-deload, wrapped, plate
  math). The streak became a character lifted out of a Lottie.
- **2026-08-16:** exercise demo gifs switched off (quality and licence), so
  the About tab leads with the instruction text.
