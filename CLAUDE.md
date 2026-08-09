@AGENTS.md

# Torq

Personal workout-session tracker (inspired by https://www.strong.app/), built by
Adilzhan. Android-first Expo React Native app. Repo: github.com/adilzhanY/torq.

**Living context file:** update this file after every user-requested change so
the next session knows where the project stands.

**Roadmap:** `PATH.md` holds the business idea, locked redesign decisions,
rank-system design, and the 4-phase plan. Read it before planning any
feature work.

## Stack

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict)
- NativeWind v5 (preview) + Tailwind CSS v4 + react-native-css 3 — CSS-first
  config, no babel plugin. `lightningcss` is pinned to 1.30.1 via npm
  `overrides` (1.32 breaks CSS deserialization in the nativewind metro
  transformer).
- Supabase for auth + cloud sync (optional; app is fully offline-capable)
- lucide-react-native icons, Space Grotesk font
  (@expo-google-fonts/space-grotesk; weights 400/500/600/700 — the family has
  no 800, so `FONT.extrabold` maps to 700 Bold)
- No router: single-screen shell with a tab switcher (`src/lib/ui.tsx`),
  same as grit mobile.

## Design

**RADIUS: SHARP-10 (2026-08-08, Adilzhan picked it in the lavish review
`.lavish/torq-radius.html`):** the app is no longer pill-round. `R` in
theme.ts is `{ lg: 16, md: 12, ctrl: 10, sm: 8, pill: 999 }` — `ctrl` (10)
is the default for anything pressable, `sm` (8) for inputs/chips/tabs/
thumbnails, `md` (12) for surfaced buttons/tiles/popovers/tooltips, `lg`
(16) for dialogs, sheets and the dock. `pill` is STATUS ONLY (LIVE, tier
pills, PR trophies, streak pill, W/D/F letters), plus true circles
(avatars, week dots, chart dots) and the round caps on thin progress bars.
Never give a plain button a pill. Reasons: the vortex mark is eight sharp
blades, and on a cardless page the interactive shapes are the only geometry
left, so they have to read as controls.

**CARDLESS PRINCIPLE (2026-08-06, Adilzhan — overrides the bento habit):**
stop wrapping content in Card/surface containers. Content is text directly
on the page background; hierarchy comes from type scale, weight, color
(ink/dim/faint + lime accents) and whitespace; where separation is needed,
use thin hairline dividers, not boxes. Surfaces are reserved for
INTERACTIVE elements only (buttons, inputs, the dock) and
true overlays (dialogs, sheets, pickers). Charts keep their plots but lose
their card frames. Applies to every new screen and the Phase-2 rebrand;
existing screens migrate as they're touched. Mockups of all pages in this
style: `.lavish/torq-cardless-pages.html`.

The design is ported from `~/dev/grit/apps/mobile` — a warm clay/bento system:

- Tokens in `src/theme.ts` (`C` palette, `R` radii, `FONT`, `clay()`/`claySm()`
  shadows). The same palette is mirrored as Tailwind theme colors in
  `src/global.css` (`bg-page`, `text-ink`, `bg-surface`, `text-accent`…).
- Brand accent is the logo lime: `C.accent = #C8FE23`, `C.primary = #1A1B1A`
  (the logo's dark square). Lime is LIGHT — anything drawn on it uses
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

Cloud sync (`src/lib/sync.ts`) is grit's last-write-wins delta sync against
generic Supabase mirror tables `{ user_id, id, data jsonb, updated_at,
deleted }` with RLS — schema in `supabase/schema.sql` (run it in the Supabase
SQL editor). Tables: `exercises`, `routines`, `workouts`, `measurements`,
`settings`, `active` (singleton in-progress session). The server stamps
`updated_at` via trigger; sync cursors live in AsyncStorage. Configure via
`.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
see `.env.example`).

State: `src/lib/store.tsx` (`useStore`) owns the DB + all domain actions and
persists on every commit; `src/lib/auth.tsx` (`useAuth`) wraps Supabase auth.
"My exercises" starts EMPTY by design (no seeding) — the user imports from
the ExerciseDB catalog or adds custom ones. The store's load path still
tombstones any leftover `seed-…` rows from the removed starter library.

## ExerciseDB catalog

`src/data/exercisedb.json` is a snapshot of the full open-source ExerciseDB
(1500 exercises) from `https://oss.exercisedb.dev/api/v1/exercises`.

SPLIT FOR STARTUP (2026-08-08, measured not guessed): the full snapshot cost
~274 ms to materialise on EVERY cold start, before the first frame — and
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
`after=<meta.nextCursor>` — the documented `cursor` param is silently ignored
(you get the same page forever). `src/lib/exercisedb.ts` loads the snapshot
and maps ExerciseDB body parts/equipment onto Torq's enums.

Gifs: the dataset's `gifUrl` points at `static.exercisedb.dev`, a domain with
NO DNS record (dead). The app instead builds URLs against Adilzhan's mirror
`github.com/adilzhanY/exercise-db` (all 1500 gifs under `media/<id>.gif`,
verified identical dataset) via `raw.githubusercontent.com`. Gifs are
remote-only (bundling ~1500 would add ~258 MB); `expo-image` caches them with
`cachePolicy="memory-disk"`. Exercises imported from the catalog carry `dbId`
on the `Exercise` row, which keys `DB_GIF_BY_ID`.

## Screens (`src/screens/`, tabs in `src/components/BottomNav.tsx`)

FOUR dock tabs plus the profile slot (2026-08-09 "Five, spelled out"):
Home (default) · Workout · Ranks · Stats, then "You" — the user's AVATAR,
which opens Profile as a full-screen overlay rather than switching tabs
(the floating top bar was REMOVED 2026-08-06; TOP_BAR_SPACE is 0).
History and Exercises are still full screens with their own Tab ids, but
they are SUB-PAGES now: History opens from Home's "Recent workouts · See
all", Exercises from the Workout tab's "Exercise library" row, and each
keeps its parent tab lit while open. Stats (tab id "stats", ChartColumn icon, titled "Progress")
is the STRENGTH page, not the workload page (2026-08-09): rank points now +
the climb (RankLine with tier bands), tier progress in points and kilos,
the dumbbell "what moved" chart, the records feed, then bodyweight and
streak. Volume/sets/hours/weekly bars/muscle split live in its "Training
load" sub-page and measurements in a "Measurements" sub-page. Home is the coach's "Today" screen: big date header
("Today"/"Yesterday"/weekday) with a calendar button (custom
CalendarDialog), a scrubbable DateRuler, then the TodayHero — today's
planned session with one-tap Start (states: live session lime / plan day
dark card with exercise preview / done-checked / rest day with next-up /
no-plan → opens the wizard via `useUi().openPlanWizard`) — then the WEEK
STRIP (Monday-first plan-week dots: trained/today/planned/rest) and the
RANK MOMENTUM block (overall RankBadge, points + weekly delta,
pts-to-next-tier bar, closest per-lift tier-up line), a
7-day volume Sparkline, and a day-aware workout list (Today → 3 most
recent; other days → that day's workouts). Calories are NOT shown on
Home (removed 2026-08-06; still on WorkoutCard/summary/Stats). The Workout tab is
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
live in each build profile's `env` block in `eas.json` — safe to commit,
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

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` —
  Expo INLINES every `EXPO_PUBLIC_*` into the app bundle, so these are
  public by definition. That is fine: the publishable key can do nothing on
  its own, RLS is what protects the data. Verified by grepping the exported
  Hermes bundle.
- `SUPABASE_DB_URL` — the Postgres superuser connection, for running
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
time — after editing `.env` you must restart Metro with `--clear` (an
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
account** — it persists as `torq.guest.v1` in AsyncStorage
(`useAuth().guest`), Profile's Account section turns into a "Sign in or
create an account" button that calls `exitGuest()`, and signing out clears
the flag so the gate returns. Profile no longer contains a sign-in form:
one screen validates passwords.

## Percentiles + plausibility

`src/data/percentiles.json` (2 KB, committed) holds DOTS-point
distributions per sex per competition lift, built by
`scripts/build-percentiles.py` from the OpenPowerlifting dump (168 MB zip,
NOT committed — re-download when refreshing). 2026-08-08 build: 4.0M meet
results → 2.2M per-lifter bests, raw only, best result per LIFTER.
Distributions are over POINTS rather than kilos because DOTS already
normalizes sex and bodyweight, so one curve per (sex, lift) serves every
weight class. `src/lib/percentile.ts` interpolates between the stored
breakpoints and returns 1–99 (clamped at the tails).

NEVER phrase these as "top N% of people". The population is people who
entered a sanctioned meet — a much stronger crowd than the gym floor — so
every surface says "of competitive lifters" and names the sample size.

`src/lib/plausibility.ts` gates what LEAVES the device: a lift above the
world record for the user's class (or over `MAX_DOTS` = 200 for movements
with no official record) is dropped from the published snapshot and from
the overall points. It is not dropped from the user's own logs, charts or
Ranks screen — the cap is about what other people are shown, and in
practice it catches decimal-point typos far more often than cheats. The
exercise Rank tab shows the reason inline when a lift is gated.

## Social (PATH.md Phase 3)

`supabase/social.sql` is the SECOND schema file (run it in the SQL editor
like schema.sql; re-running is safe). It is deliberately separate from the
private mirror tables: those hold raw logs and never leave their owner.

- `profiles` — user_id, unique citext `handle` (3–20 of `[a-z0-9_]`),
  display_name, `visible` (opt-in, default false).
- `friendships` — requester/addressee/status (pending·accepted·blocked),
  unique on the ordered pair. RLS splits the verbs on purpose: you INSERT
  only rows where you are the requester, UPDATE only rows addressed TO you
  (so nobody accepts on your behalf), DELETE any row you are part of
  (decline = cancel = unfriend = "remove the edge").
- `rank_snapshots` — the published half of the rank engine: points, tier,
  stage, top-5 lifts as jsonb. Readable by you and accepted friends via the
  SECURITY DEFINER `are_friends()` helper.
- `rank_events` — one row per TIER change, the friends' feed. Same friend
  scoping; insert/delete own, and NO update policy at all (an event is a
  fact about a moment, so it can be created or removed but never rewritten).
  `publishRankFromData()` writes them by diffing the stored snapshot against
  the freshly computed rank: PROMOTIONS ONLY (a tier can fall when
  bodyweight rises — "reached Silver" would be a lie on the way down),
  nothing at all on a first publish, and idempotent because the diff is
  against the stored row, so republishing on every workout and every Friends
  open cannot duplicate an event.
- `find_profile(handle)` / `handle_taken(handle)` / `search_profiles(query)`
  — SECURITY DEFINER RPCs, execute granted to `authenticated` only.
  `search_profiles` (2026-08-08) does prefix/substring matching on handle
  and display name, bounded on purpose: `visible` profiles only, 2-character
  minimum, 20-row cap, and it returns only handle + display name. Backed by
  pg_trgm GIN indexes so it does not degrade into a sequential scan.

`src/lib/social.ts` wraps all of it, every call returning
`{ data, error }` with an already-friendly message. `publishRankFromData()`
computes the rank locally and upserts the snapshot; it runs after every
`finishWorkout()` (fire-and-forget — signed out and offline are normal) and
whenever the Friends view opens. `sendRequest()` handles the crossing case:
if they already asked you, adding them back accepts instead of creating a
second edge in the opposite direction.

`src/screens/Friends.tsx` renders inside the Ranks tab behind a You/Friends
switch, with three states: guest → offer the account; no profile → claim a
handle (the opt-in); otherwise incoming requests, add-by-handle, friends
sorted by points (badge · name · @handle · top lift · pts; tap to compare,
hold to remove), then outgoing requests. It owns its OWN ScrollView and
Ranks renders it OUTSIDE the You-view ScrollView — an absolute overlay
inside a ScrollView positions against the scroll content, not the window,
so the compare and confirm overlays would scroll away otherwise.

`src/components/FriendCompare.tsx` is the head-to-head: two badge columns,
the points lead, and a lift-by-lift table keyed on a name slug. It compares
DOTS POINTS, not kilos — comparing raw weight between a 60 kg and a 95 kg
lifter would undo the normalization the whole app is built on. A friend's
snapshot only carries their top 5, so a blank cell means "not in their top
five", which the caption says out loud.

`src/components/ShareCard.tsx` turns things into 4:5 story images:
`ShareSheet` is the overlay + capture + system share sheet, and each card
FACE is a child of it (`ShareRankCard`, `ShareWorkoutCard` — add faces, not
capture code). The mechanism:
react-native-view-shot `captureRef` + `expo-sharing` (both in Expo Go,
checked against the SDK 57 docs). The card is the VISIBLE overlay, not an
off-screen view — off-screen views can capture blank on Android, and the
user should see what they are about to post. captureRef sizes in logical
points, so the 1080×1350 output comes from dividing by `PixelRatio.get()`
(the trick the Expo docs spell out). `expo-sharing`'s config plugin got
auto-added to app.json by `npx expo install`; it is a no-op here (its
options default to disabled) because we only SEND shares.

## Keyboard — RULE FOR EVERY NEW INPUT

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

## Sound

`assets/sounds/*.m4a` are SYNTHESIZED by `scripts/build-sounds.sh` (ffmpeg,
plucked sine tones in A minor pentatonic, ~3–14 KB each), not sampled from a
stock library. Reasons, in order: no licence to honour in a paid app, tiny
files, and they actually match the design — dark and sharp rather than the
cinematic whoosh every free SFX pack is full of. Pitch rises with
significance: rest tick (A4, quietest — it repeats) < set done (E5+A5 blip)
< go (A5+E6) < workout done (A4-C5-E5-A5 run) < PR (E5-G5-C6-E6). Tweak a
number in the script and re-run it; don't hand-edit the m4a.

`src/lib/sounds.ts` (expo-audio, in Expo Go) enforces two rules:
NEVER interrupt the user's music — the audio mode is `mixWithOthers` with
`playsInSilentMode`, because people lift to Spotify and an app that pauses
it to go "ding" gets uninstalled — and players are created ONCE and reused
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
  not style — it is the fix for a total app failure. The package's
  `index.js` re-exports `DevicePushTokenAutoRegistration.fx`, which calls
  `addPushTokenListener()` AT MODULE SCOPE, and that helper THROWS in Expo
  Go on Android (remote push was removed in SDK 53). A throw during require
  takes the whole bundle down, so the app showed a red "[runtime not ready]"
  box and never rendered a frame — and the `pushSupported()` guards were
  useless, because the crash happened at import time before any of our code
  ran. Found on the emulator 2026-08-09; it had been broken since push
  landed. `primePush()` (called from App.tsx) warms the module and installs
  the foreground handler in real builds, and is a no-op in Expo Go.
- Remote push is DEAD in Expo Go from SDK 53. `pushSupported()` (now
  `!isRunningInExpoGo()`) detects that and every function no-ops, so
  `run_android.sh` still works — it just won't deliver pushes. Testing push
  needs a dev/preview build.
- Permission is requested when the user opens **Friends**, not at launch.
  The OS prompt appears once; shown out of context it gets denied forever.
- `unregisterPush()` runs on sign-out. A token left behind would deliver the
  next person's friend requests to the previous owner's phone.
- The Edge Function uses the SERVICE ROLE key to read recipients' tokens
  (their RLS correctly forbids everyone else). That key must never appear in
  the app bundle — which is exactly why the decision to notify lives server
  side, quite apart from the fact that a closed phone can't notice anything.
- `tsconfig.json` now EXCLUDES `supabase/functions`: it's Deno, with URL
  imports and different globals, and `npm run tsc` would fail on it.

Setup steps only Adilzhan can do (FCM credentials, deploy, webhooks) are in
`supabase/functions/notify/README.md`.

## Entitlements / paywall

`src/lib/entitlements.ts` is the ONLY place that decides what is paid. The
split lives in the `FEATURES` table as data — the point is that changing the
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
- Ranked on DOTS points, not kilos — a global board mixing bodyweights is
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

- `delete_my_account()` in supabase/social.sql — SECURITY DEFINER because it
  must reach `auth.users`, which no client role can touch. It takes NO
  parameter and only ever deletes `auth.uid()`'s rows, which is what makes
  granting it to `authenticated` safe. Everything cascades from auth.users
  anyway; the explicit deletes are belt-and-braces for tables added later
  without a cascade.
- `deleteAccount()` in social.ts, then `wipeLocalData()` — BOTH are
  required. Deleting only the cloud copy would leave the phone's history to
  re-upload itself on the next sign-up, so the "deleted" account would come
  back.
- `exportData()` (`src/lib/exportData.ts`) writes the whole DB as JSON and
  opens the share sheet. Uses the SDK 57 `File`/`Paths` API — the old
  `FileSystem.cacheDirectory` + `writeAsStringAsync` moved to
  `expo-file-system/legacy` in this version.
- With no account, the destructive button becomes "Erase all data on this
  phone" and says plainly that there is no cloud copy to restore from.

## Failure handling

`src/components/ErrorBoundary.tsx` wraps the app twice: once PER TAB (keyed
by tab, so a crash in Stats leaves the dock alive and the user can walk to
another tab instead of force-quitting) and once around the whole tree for
crashes outside a tab (onboarding, the auth gate, providers). The recovery
screen NEVER touches storage — every option re-renders or navigates. A bug
in a chart must not be able to take a year of workouts with it. Reset works
by bumping a key so the subtree remounts; without that React reuses the same
instances and rethrows immediately.

`loadDB()` used to swallow a JSON parse failure and return an empty DB.
That was silent data loss: the app looked like a fresh install and the next
save overwrote the user's real history. It now parks the unreadable blob
under `BACKUP_KEY` and sets a failure flag that the store exposes as
`loadError`, which App.tsx surfaces as a red banner BEFORE the user can log
a session on top of it. A missing key is still treated as a genuinely new
install — only an unparseable one is an error.

## Tests

`npm test` (vitest, `src/lib/__tests__/`). 128 assertions over the PURE
logic: rank/DOTS, percentiles, plausibility, records matching, password
policy, streaks, weight progression, plan generation, calories, PRs. No
component tests — the libs are where the product's claims live, and they
import no React Native, so vitest runs them directly with no RN harness.

Two things this bought immediately:
- It caught a REAL bug on the first run: `MAX_DOTS` was 200 on the
  assumption that elite single lifts score 130–140 DOTS. They don't — DOTS
  is calibrated for a three-lift TOTAL, so a world-record single scores
  ~270, and the cap would have silently refused to publish real elite lifts.
- The `plan.test.ts` sweep (4 goals x every 2–6 day subset x focus combos,
  1000+ combinations) is the regression net for the generator; that shape of
  check is what caught flat 5x5 producing two-hour sessions.

Run it before every commit; `npm run tsc` only proves types, not behaviour.
Note both data modules now use `import x from "*.json"` rather than
`require()` — Metro supports both, but vitest is ESM and `require` is not
defined there.

## Launch docs

`docs/launch/` holds the Play release pack: `PRIVACY.md`, `DATA_SAFETY.md`,
`STORE_LISTING.md`, `LAUNCH.md`.

`DATA_SAFETY.md` was written against the real schema, not from memory —
Google audits Data Safety answers against observed network traffic and pulls
releases that misdeclare. Two things there are easy to get wrong and are
called out in the file: bodyweight/sex ARE collected (the rank engine
normalizes on them) even though other users never see them, and publishing a
rank to another torq user is NOT third-party "sharing" under Play's
definition. Re-check the whole sheet when analytics, billing or regional
boards land.

## Commands

- `./run_android.sh [avd]` — one-shot run: boots the named AVD (default
  `torq`) if needed, pins all adb/expo work to that emulator's serial via
  `ANDROID_SERIAL` (safe while other emulators run other projects), keeps
  Expo Go IN SYNC with the SDK's required version (queries Expo's versions
  API, installs from/downloads to `~/.expo/android-apk-cache` on mismatch —
  Adilzhan's other project keeps downgrading Go on the shared `torq` AVD,
  which broke launches with "Project is incompatible with this version of
  Expo Go"), REUSES an already-running Metro of this repo (matched by
  process cwd) instead of stacking duplicates, else auto-picks the first
  free port and opens `exp://10.0.2.2:<port>`. Preferred way to run the
  app.
- `npm start` / `npm run android` — dev server
- `npm run tsc` — typecheck (keep this clean)
- `CI=1 npx expo export --platform android` — verify the bundle compiles

## Dev environment (this machine)

Android tooling lives user-locally (no root): JDK 21 at `~/.local/jdk`,
Android SDK at `~/Android/Sdk` (platform-tools, emulator, android-36 image).
AVDs `torq` and `torq2` (both Pixel 7, hw.keyboard=yes) are at
`~/.config/.android/avd` — the emulator only finds them with
`ANDROID_AVD_HOME=~/.config/.android/avd` exported. `torq2` exists so Torq
can run beside Adilzhan's other project (which occupies `torq`/8081):
`./run_android.sh torq2`. Used in anger 2026-08-09 — with Claude Code open
on the grit repo too, Expo Go on the shared `torq` AVD kept reopening THAT
project, so torq moved to `torq2` (emulator-5556) while grit kept
emulator-5554. The script boots the AVD, syncs Expo Go to the SDK's required
version, reuses this repo's existing Metro instead of stacking a second one,
and pins ANDROID_SERIAL — so the two sessions never fight. Always export
ANDROID_SERIAL for adb calls when both are up. Launch:
`ANDROID_AVD_HOME=~/.config/.android/avd ~/Android/Sdk/emulator/emulator -avd
torq -gpu host`, then `npx expo start --android` (Expo Go).

## History

- 2026-07-04: Project created. Expo template + NativeWind v5/Tailwind v4 set
  up; grit mobile design system and Supabase sync layer ported and adapted to
  the workout domain; five screens scaffolded; pushed to
  github.com/adilzhanY/torq (branch `main`).
- 2026-07-04: Local Android emulator installed (JDK 21 + SDK + Pixel 7 AVD,
  see Dev environment); app verified running in Expo Go on it. Brand logo
  (lime pulse on dark square) added as `Logo.tsx`, shown in the top bar and
  loading screens.
- 2026-07-05: Rethemed to the brand accent: orange → lime `#C8FE23`, primary
  dark aligned to the logo's `#1A1B1A`, `C.accentInk` added for dark-on-lime
  content. Verified on the emulator (home, live session, set-check flow).
- 2026-07-05: Showcase README added (view-only, no setup instructions, per
  Adilzhan) with the brand SVG at `assets/logo.svg` and emulator screenshots
  in `docs/screens/`.
- 2026-07-05: Full ExerciseDB catalog (1500 exercises, gif demos) integrated —
  see "ExerciseDB catalog" above. Exercises tab now searches the user library
  AND the catalog (paged 30 at a time); catalog cards expand to gif +
  instructions and can be imported into the library. An earlier 30-exercise
  Kaggle sample integration was replaced by this and deleted. expo-image
  added.
- 2026-07-05: Gif hosting switched to Adilzhan's own mirror
  github.com/adilzhanY/exercise-db (raw.githubusercontent.com) after the
  upstream media hosts proved dead (`static.` no DNS) or bot-challenged
  (`v1.` behind a Vercel checkpoint). Verified rendering on the emulator:
  catalog thumbnails + expanded demo gif with instructions.
- 2026-07-05: Removed the 36-exercise seeded starter library (seed.ts
  deleted; one-time tombstoning cleanup in the store). Library is now
  import-from-catalog or custom only; verified import flow end to end.
- 2026-07-05: Added 3 recommended routines (Push/Pull/Leg Day — a 3-day
  split) to the Workout tab with gif thumbnails and set×rep schemes;
  starting one auto-imports its exercises and prefills the live session.
  Verified on the emulator.
- 2026-07-06: Strong-style live-session upgrades in `Workout.tsx`
  (ActiveSession): elapsed workout timer in the header (1s ticker via
  `useNow`); rest timer — every set row has a `RestDivider` showing the
  planned rest (`settings.restSec`, default 2:00) that turns into a lime
  countdown progress bar when its set is checked (tap to skip, vibrates on
  finish; one active rest at a time, local state only); PREVIOUS column
  showing last performance per set index from the most recent finished
  workout containing that exercise (column hidden entirely for first-time
  exercises); tapping a set number opens a set-type menu (Warm up W orange
  `C.warnAcc`, Drop set D purple #7c5cd6, Failure F red `C.badAcc`) — typed
  sets show the colored letter instead of a number, normal-set numbering
  skips them, re-picking the active type reverts to normal. Set rows got a
  Strong-style SET/PREVIOUS/KG/REPS header row (unit from settings).
  Verified on the emulator.
- 2026-07-06 (later): live-session polish — tapping an idle rest divider
  pops open (PopIn) an inline per-set rest editor, an ATM-style masked
  m:ss duration input (Adilzhan's preferred pattern; reworked from a plain
  seconds field): always displays m:ss, digits push in from the right
  (2 → 0:02 → 0:20 → 2:00), and once all 3 slots are filled new digits
  shift the seconds only, minute locked (2:00 + 3 → 2:03 + 0 → 2:30).
  Implemented as a formatted Txt over a hidden TextInput holding the raw
  digit buffer; prefilled value shows a fake lime "selected" highlight
  until the first keystroke replaces it (`selectTextOnFocus`). Commit on
  enter/blur, clamped 5–599s; saved as `WorkoutSet.restSec` (optional
  field in types.ts, falls back to `settings.restSec`) so it rides along
  in sync. Set rows are denser (`NumberField` got `compact`, `center`,
  `autoFocus`, `selectTextOnFocus`, `onBlur` props; done check shrunk
  38→32) and a done set's whole row tints lime (`rgba(160,210,20,0.42)`),
  full-bleed to the card edges (margin −16 cancels the Card padding).
  KG/REPS cells are `SetNumInput` (Workout.tsx, width `FIELD_W`=50,
  digits centered): an input while the set is open; once done it renders
  as a plain centered number that turns back into a focused
  select-on-focus input when tapped, so completed sets stay editable.
  Verified on the emulator.
- 2026-07-06 (later): tapping the running rest bar no longer skips — it
  toggles a Strong-style control pad. NOT a Modal: a Modal clipped its
  bottom rows on this emulator (content rendered partly below the window),
  so the pad is an inline overlay inside ActiveSession's root View:
  full-width, `bottom:0`, top-rounded, `paddingBottom:96` so it slides up
  from behind the BottomNav (custom `SlideUp` translateY spring — not
  PopIn). ActiveSession's root is now a flex-1 View wrapping the
  ScrollView. Grid layout per Adilzhan's sketch: full-width Pause/Resume
  on top (rest state gained `paused`/`pausedMs`; bar freezes with a pause
  icon), below it ONE row, all height 56: square 64-wide + / − (±20s via
  `bumpRest`, ending the rest at zero) then SKIP and RESET splitting the
  remaining width (SKIP clears rest and focuses the next set's weight
  input via the `weightRefs` map; RESET stops the rest and reopens that
  set's inline seconds editor via an `editNonce` prop). Gotcha: Squish
  applies `style` to its inner Animated.View, so `flex:1` on a Squish
  does nothing in a row — wrap it in a flex-1 View. Icon gained `Minus`.
  Verified on the emulator.
- 2026-07-06 (later): rest countdown is now a Strong-style tall bar
  (`RestCountdownBar`): 40px lime bar that starts full and drains leftward
  in one continuous `Animated.timing` (linear, driven by `endsAt`, width
  interpolated 0–100%), remaining time centered on it, PopIn entrance, tap
  to skip. The set-type menu is an anchored popover: opens at the tap's
  pageX/pageY (`animationType="none"` + PopIn, flips above when near the
  screen bottom) instead of a centered modal. Verified on the emulator.
- 2026-07-06: Exercise search is now token-based (`matches()` in
  `src/screens/Exercises.tsx`): every query word must appear somewhere in
  name/bodyParts/equipment/targetMuscles, any order — "bicep curl" finds
  "Cable Lying Bicep Curl" etc. Catalog results rank name-matches above
  muscle-only matches. Also enabled the hardware keyboard on the `torq` AVD
  (`hw.keyboard = yes` in its config.ini + device setting
  `show_ime_with_hard_keyboard 0`) so you can type in the emulator with the
  host keyboard.
- 2026-07-07: Added `run_android.sh` (see Commands) — single script to boot
  the emulator if needed and start Expo; Adilzhan runs it himself, so don't
  spend turns launching the app manually.
- 2026-07-07: Strong-style "Add exercises" picker
  (`src/components/ExercisePicker.tsx`), replacing the old bottom-sheet
  picker in the live session. Full-screen inline overlay (NOT a Modal —
  the emulator Modal-clipping gotcha) over ActiveSession, listing the
  library merged with the whole ExerciseDB catalog (imported dbIds
  deduped; catalog rows import on add). Toolbar: Search (toggles the
  token-search field; `matches()` moved to `src/lib/search.ts`, shared
  with the Exercises tab), Filter (centered dialog, multi-select body
  part + category chips, live match count in the title, funnel icon gets
  a lime badge when active), Order (anchored popover: Name → letter
  sections / Frequency → Strong buckets "26+ / 11–25 / 6–10 / 1–5 times /
  Not performed" with per-exercise session counts / Last performed →
  recency buckets), Plus (bottom-sheet "New exercise" form — name +
  chips; saving auto-selects the new row). Rows multi-select (lime tint)
  into an "Add N exercises" CTA that appends all picks to the session.
  `addExercise` in the store now returns the created row; `SlideUp` moved
  to `components/anim.tsx`; hardware Back peels overlays then closes.
  Gotcha hit while verifying: after Metro restarts, Expo Go happily keeps
  running its cached JS — `adb shell am force-stop host.exp.exponent`
  then reopen `exp://<host>:8081` to force a fresh bundle. Verified on
  the emulator (sections, all three sorts, filter counts, create + add
  flow).
- 2026-07-07: Custom (gif-less) exercises now show a dumbbell-icon tile in
  the thumbnail slot (Exercises tab + picker), and "My exercises" rows show
  body part/equipment as Pill badges like the catalog cards. Verified.
- 2026-07-07: Strong-style post-workout summary
  (`src/components/WorkoutSummary.tsx`, full-screen inline overlay like the
  picker): auto-named title, long date line, per-exercise cards with a
  per-set estimated-1RM column (Epley, `src/lib/stats.ts`), trophy PR pills
  (1RM / Weight / Vol.) on record-setting sets, pinned footer with duration ·
  total volume · PR count. Shows right after Finish workout (finishWorkout
  now returns the finished Workout; `Workout()` holds `summary` state) and
  when tapping a History card (History cards are now Pressable).
  `computePRs` judges each set against all earlier workouts plus earlier
  sets of the same session (only the record-setting set gets the badge;
  warmups ineligible; ties don't count). Quick-start sessions are now
  auto-named by local hour (`workoutName`: Morning/Afternoon/Evening/Night
  Workout); routine starts keep the routine name. `SET_TYPE_META` moved to
  `src/theme.ts`; `fmtDuration` moved into stats.ts (History imports it).
  Verified on the emulator: finish flow, History detail, first-ever-exercise
  PRs, tie-no-PR, 0-PRs-when-history-is-heavier, Evening auto-name.
- 2026-07-07: Adding a known exercise to a live session now replays its most
  recent finished workout (`lastSetsFor` in stats.ts): same set count and
  types (warmups and drop sets kept, FAILURE sets dropped), KG/REPS/per-set
  rest prefilled from last time, all unchecked; first-time exercises still
  get one empty set. Wired into ExercisePicker's onAdd in Workout.tsx.
  Verified on the emulator against a real 6-set bench session (W 20×15
  replayed as W with values; PREVIOUS column aligns per index).
- 2026-07-07: Exercises tab unified with the picker: the shared list core now
  lives in `src/components/ExerciseBrowser.tsx` (sectioned library+catalog
  list, Search/Filter/Order/New toolbar, order menu, filter dialog,
  new-exercise sheet; optional `onBack`, `selected`, `footer` props).
  `ExercisePicker` is a thin overlay wrapper adding multi-select + the
  "Add N exercises" CTA (passed as `footer` so the sheet stacks above it).
  `Exercises.tsx` rewritten: the browser plus a full-screen `ExerciseDetail`
  overlay on row tap (big gif / dumbbell placeholder, body-part+equipment
  pills, "in your library" pill, catalog instructions, Add-to-library or
  Delete-from-library action that flips live). The old My-exercises/
  Exercise-database card layout and DbExerciseCard are gone. Verified on
  the emulator: browse, detail open, add→delete round-trip.
- 2026-07-07: Exercise info page (`src/components/ExerciseInfo.tsx`,
  Strong-style): About / History / Records pill tabs in a full-screen
  overlay. Opened from the live session (exercise names are now tappable)
  and from Exercises-tab rows (replaced the old single-page ExerciseDetail).
  About = the former detail (gif, muscles, instructions, add/delete).
  History = History-style cards (extracted into
  `src/components/WorkoutCard.tsx`, shared with the History tab) for
  workouts containing the exercise; tapping one opens WorkoutSummary with
  the new `highlightExerciseId` prop — that exercise's card gets a light
  green border. Records = personal records (est 1RM / max weight / max
  single-set volume), a REPS · BEST PERFORMANCE · ESTIMATED rep-max table
  (best real set at ≥N reps with date; estimated = inverse-Epley `repMax`
  in stats.ts off the best 1RM; rows to 12), and lifetime totals; warmups
  can't set records, matching computePRs. Verified on the emulator end to
  end. Live-session exercise names render as black (`C.primary`) fully
  rounded badges with white text (still tap-to-open-info).
- 2026-07-07: BottomNav redesigned as a floating dock (reference: iOS
  pill-dock pattern): dark `C.primary` pill floating 8px above the safe
  area (left/right 14, height 62, fully rounded, clay shadow); the active
  tab is a `C.surface` capsule with icon + bold label, inactive tabs are
  translucent-white icons. One Animated.Value per tab morphs flex (1→2.6),
  capsule fill, icon crossfade, and label reveal (maxWidth 0→96 + late
  opacity ramp) in parallel — the capsule reads as sliding between tabs.
  Motion is a 260ms Easing.out(cubic) TIMING, not a spring: spring
  overshoot fed the unclamped flex interpolation below its floor, making
  the deflating tab dip narrower and wobble ("old icon drags"); all
  interpolations are also clamped. useNativeDriver:false (flex is layout).
  No + button by design. Verified on the emulator.
- 2026-07-09: Shared centered dialog (`src/components/Dialog.tsx`):
  `CenterDialog` (dim backdrop + PopIn Card, tap-outside dismiss — the
  Filter-dialog pattern extracted; inline overlay, NOT a Modal, so mount it
  inside a flex-1 screen root) and `ConfirmDialog` built on it (title,
  optional message, Cancel / red confirm-then-close). ExerciseBrowser's
  filter dialog now uses CenterDialog, and every destructive action
  confirms via ConfirmDialog: removing an exercise from a live session
  (the previously unguarded trash button), deleting a routine (Workout
  start screen), a workout (History), a measurement (Measure — its root
  gained a flex-1 View wrapper for the overlay), and an exercise from the
  library (ExerciseInfo About tab). Use these for any future centered
  modal.
- 2026-07-09: Home tab added, Profile moved to the top bar. New
  `src/screens/Home.tsx` dashboard (see Screens above); default tab is now
  `home` (`Tab` type in `src/lib/ui.tsx` swapped profile → home; dock icon
  `House` added to Icon.tsx). Profile left the dock: the top bar gained a
  right-aligned `UserCircle` button (App.tsx holds `profileOpen` state) and
  `Profile.tsx` became a SlideUp full-screen overlay with a ChevronLeft
  header and hardware-Back close, rendered above the BottomNav so the dock
  is covered. Verified on the emulator: Home stats/CTA/recents, profile
  open/close, dock morph with the new Home tab.
- 2026-07-10: Animated "Add set" — new `GrowIn` primitive in
  `components/anim.tsx`: mount entrance that grows the content in from zero
  height (220ms ease-out) while fading/sliding it down, then releases the
  clip once settled so later inner layout changes flow naturally. GOTCHA:
  the inner content must be `position: absolute` while animating (same
  trick as Collapsible) — inside the 0-height clipped parent a normal-flow
  child lays out at height 0 on Fabric, so onLayout never reports a
  measurable height and the content stays invisible; it returns to normal
  flow on settle (no remount, style-only change). In Workout.tsx only sets
  appended via the Add set button animate: their "ei-si" keys go into the
  `grownSets` ref and the set block wrapper picks GrowIn vs View off it —
  restored sessions and last-time prefills mount statically. Verified on
  the emulator via screenrecord frames (grow + fade visible, settled state
  correct).
- 2026-07-10: Set-type menu anchored to the set number. It now anchors to
  the number element's page origin (pageX/Y − locationX/Y from the touch
  event) instead of the finger position, offset −16 horizontally so the
  W/D/F letter column sits exactly under the number, top just below the
  row. GOTCHA fixed along the way: the app is edge-to-edge but a plain
  Android Modal's window starts below the status bar, so pageY-anchored
  children rendered ~a status bar (~43dp) too low — `statusBarTranslucent`
  on the Modal aligns the two coordinate spaces. Verified with exact-tap
  screenshots.
- 2026-07-10: Calorie estimation (`src/lib/calories.ts`), built on the
  personal Mifflin-St Jeor BMR (weight/height/age/sex → resting kcal).
  Three per-completed-set components; the wall clock is ignored ENTIRELY,
  per Adilzhan — activity only (v1 billed idle-session time: one light set
  showed 186 kcal; v2 capped billing at elapsed time, which crushed
  workouts backfilled from another app in minutes: a real 22-set session
  showed 89 kcal): (1) lifting work 0.008 kcal per kg·rep (physics +
  ~20-25% muscle efficiency + eccentric; set weights converted from the
  display unit; bodyweight-equipment exercises add 0.6× body mass to the
  load), (2) work time ~15s + 4s/rep at Compendium METs (resistance 3.5 /
  olympic 6 / cardio 7), (3) planned per-set rest (set override or
  `settings.restSec`, clamped 30–240s) at 1.8 MET. 0 done sets → 0 kcal;
  backfilled and live sessions bill identically. Sanity: ~10 kcal for one
  70kg×5 set, ~246 kcal for a 22-set ~7000kg session. `Settings` gained optional
  `sex`/`birthYear`/`heightCm`/`weightKg` (ride along in sync; edited in a
  new Profile "Body profile" card — weight entered in the display unit,
  stored in kg). Effective weight prefers the latest Measure-tab "Body
  weight" entry at/before the workout (`bodyProfileAt`), so history
  reflects weight at the time; missing fields fall back to
  75kg/175cm/25/male with `complete:false`, which Home surfaces as a "set
  your body stats in Profile" hint. Shown as a Home "Today" card (finished
  workouts today + live session, Flame on lime) and a 4th Flame stat in
  the WorkoutSummary footer (footer text 13px / padding 14 to fit four
  stats).
- 2026-07-10: WorkoutCard's date pill now includes the completion time —
  "Fri, Jul 10 · 9:41" (`endedAt`, falling back to `startedAt`); no schema
  change, the field was already stored. Also added a calories pill (warm
  orange `warnAcc`/`warnSurf`, hidden at 0 kcal, computed on the fly via
  `workoutCalories` with the body profile as of the workout). Both show
  everywhere the card is used (History, Home recents, exercise-info
  History).
- 2026-07-10: Charts upgraded to react-native-gifted-charts (Adilzhan
  judged the hand-rolled SVG charts "cheap"; reference: iOS strength-app
  card). New `src/components/ProCharts.tsx`: `TrendLine` (curved area
  line, grid + vertical rules, y-axis floored near the data via
  yAxisOffset, sparse date labels, HOLD-to-inspect tooltip — dark pill
  with "Mon, 1 Jun · 79 kg" in lime, pointerConfig with
  activatePointersOnLongPress so scrolling isn't hijacked — and an
  optional reference line; GOTCHA: referenceLine1Position takes the RAW
  value, gifted subtracts yAxisOffset itself — pre-subtracting made the
  line invisible), `ProBars` (rounded bars, top value labels, lime
  highlight, maxValue pinned ~1.2× data max — the auto axis leaves short
  bars swimming), `RangePills` (14D/1M/3M/6M/12M/All), `MetricPills`
  (outlined chips), `MinMaxTiles`, `MuscleBreakdown` (single stacked bar
  in a monochrome ink ramp + legend dots with %, top-4 + Other).
  ExerciseInfo Charts tab redesigned to the reference: big current value +
  week-over-week trend arrow/line, range + metric selectors (1RM / Top
  Weight / Volume / Reps), TrendLine with an all-time-PR reference line,
  Min/Max tiles. Stats tab now uses ProBars / MuscleBreakdown / TrendLine.
  The old hand-rolled LineChart/BarChart/HBars were deleted from charts.tsx
  (SegmentedBar/ArcGauge/Sparkline/fmtShort remain). Deps added:
  react-native-gifted-charts + expo-linear-gradient. Verified on the
  emulator incl. the live tooltip.
- 2026-07-10: Stats tab + chart kit + exercise Charts (roadmap task 5,
  Adilzhan's spec). charts.tsx grew into the shared kit: `LineChart`
  (min/max + date labels, area fill, lime latest-dot), `BarChart` (value
  on top, label under, lime highlight), `HBars` (horizontal labeled bars),
  `fmtShort` (12800→"12.8k"), plus existing SegmentedBar/ArcGauge/
  Sparkline. Measure tab → Stats (see Screens; Measure.tsx deleted, tab id
  "stats"). stats.ts gained `exerciseSeries` (per-session best-1RM / top
  weight / volume / reps, working sets only). ExerciseInfo gained a 4th
  "Charts" tab: est-1RM line, heaviest-weight line (purple), last-10
  session-volume bars, total-reps line (teal). Store gained dev actions
  `seedDemoWorkouts` (12 weeks of progressive PPL, verified catalog dbIds,
  plateau at week 5 + deload at week 8, tagged notes:"demo-seed") and
  `removeDemoWorkouts` (deletes only the tag) behind a Profile "Developer"
  card. Verified on the torq2 emulator: seeded 36 workouts, Stats page +
  bench Charts all render (progression + deload dip visible). GOTCHA: the
  Expo Go "Tools button" floating gear overlays the app (it sat on the
  profile avatar) — toggle it off in the Expo dev menu when driving the
  UI by adb taps.
- 2026-07-10: Routine ⋯ menus + editor (Adilzhan's spec, Strong reference).
  Grid cards' trash → Ellipsis opening a CenterDialog menu (MenuRow
  extracted from WorkoutSummary into Dialog.tsx): my routines get
  Edit / Rename (CenterDialog + TextField) / Archive / Duplicate (name +
  " (n)" via uniqueName, deep-cloned sets) / Share (text sheet) / Delete
  (ConfirmDialog); recommended get only "Duplicate to my routines"
  (`importRecommended` store action; plain name unless taken).
  `updateRoutine(id, patch)` store action powers rename/archive;
  `Routine.archived` hides cards into an "Archived (n)" grid section
  whose menu offers Unarchive/Delete. Section headers are now
  "Routines (n)" / "Recommended" (18px extrabold, replacing the uppercase
  SectionTitle). New `src/components/RoutineEditor.tsx`: full-screen
  overlay (fixed header + lime Save pill) editing a template's sets
  (weight/reps NumberFields, X to remove, Add set duplicates the last)
  with a per-exercise ⋯ menu — Replace exercise (ExercisePicker in
  single-swap mode, keeps the set scheme) / Remove exercise — and an
  Add-exercises footer (multi picker, new entries 3×10). Back cancels,
  Save commits via saveRoutine (plan/weekday preserved). Verified on the
  emulator: grid, menu, editor, exercise menu.
- 2026-07-10: Start-Workout routines as a 2-column grid (Adilzhan's spec):
  shared `RoutineGridCard` in Workout.tsx — fixed 168px height, no gifs,
  name + up to 4 "N × Exercise" lines (sets count only, no reps), "· · ·"
  overflow row, small trash for user routines; whole card tap starts the
  routine. `TwoColumnGrid` chunks cells into flex rows (flex:1 wrapper
  Views — the Squish gotcha again). Applies to user/plan routines AND
  Recommended (old RecommendedCard with gif thumbnails + Start button
  deleted). Verified on the emulator.
- 2026-07-10: History grouped by month (Strong-style, Adilzhan's request):
  month name left + "N workouts" right per section, newest first; months
  outside the current year render as "July 2025". The old flat
  "N workouts" SectionTitle is gone. Verified on the emulator.
- 2026-07-10: Suggested next weights (roadmap task 4).
  `src/lib/suggest.ts` — double progression: every top-weight working set
  hit the target reps last session → +1 step (2.5 kg / 5 lb, rounded to
  step); missed once → repeat; missed twice at the SAME top weight →
  deload to ~90% (≥1 step below, floored at 1 step → repeat). Warmups and
  bodyweight (0-weight) history never count; only finished workouts.
  Applied in `startWorkout` ONLY to routine entries with no hand-typed
  weights (plan routines are weight-less; typed routine weights are
  respected) using `targetRepsOf` (modal non-warmup reps). Prefilled sets
  carry `WorkoutSet.suggested: "up"|"down"` → the logger's weight cell
  shows a tiny TrendingUp/Down corner badge (good/warn colors), cleared
  the moment the user edits the weight and stripped in `finishWorkout`.
  Ad-hoc picker adds still replay last session verbatim (no prescription →
  no honest judgement). Verified: 23-scenario table (hits, misses, stalls,
  deload rounding/floor, warmups, backoffs, lb steps, unsorted history).
- 2026-07-10: Home hero reworked around the plan (roadmap task 3). New
  TodayHero (see Screens above) replaces the generic dark CTA; gauges went
  plan-relative WEEK-scope (workouts/sets/minutes vs the stored plan
  routines; fallbacks 3/60/180 when plan-less) — typed
  activeMinGoal/setsGoal/volumeGoal fields DELETED from Settings (never
  released; kcalGoal survives, Profile's Daily-goals card is now
  calorie-only), `dailyGoals()` → `kcalGoal()` in stats.ts. plan.ts gained
  `routineMinutes`/`routineSets` (verified to agree with planDayMinutes);
  charts.tsx gained `Sparkline` (7-day volume teaser card ending at the
  selected day, ink polyline + lime end dot). planWizard state moved into
  `useUi()` (openPlanWizard/closePlanWizard) so Home's no-plan hero and
  Profile's Rebuild plan share it; Icon gained Moon (rest-day hero).
- 2026-07-10: Training plan + onboarding — the "coach, not notebook" pivot
  (Adilzhan's direction: differentiate from Strong; roadmap lives in the
  session task list: next are Home plan-hero, suggested weights, Progress
  tab). `src/lib/plan.ts`: deterministic generator — the user picks CONCRETE
  training weekdays (2–6, Monday-first day-row list in onboarding, max 6 so
  one rest day survives; `PlanPrefs.weekdays`, 0=Sun); the count picks the
  split (2 FB A/B · 3 PPL · 4 UL×2 · 5 PPL+UL · 6 PPL×2 with B-variants)
  and templates zip onto the chosen days via `mondayFirst()`. Verified over
  all 1428 goal×weekday-subset×focus combos (0 problems),
  goal picks schemes (muscle 4×8/3×12 · lean 3×12/3×15 · fit 3×10/3×12 ·
  strength runs mains-first: first 2 compounds 5×5×180s, rest 3×8 — flat
  5×5 made 2-hour sessions, caught by the exhaustive spot-check), focus
  parts get +1 set + unlock a per-day extra slot, days trimmed from the
  tail to a 90-min cap. Exercises referenced by VERIFIED dbIds (snapshot
  names have mojibake, e.g. "sled 45в° leg press" — never match by name);
  missing ids skip. Verified: 160 goal×days×focus combos, 0 problems.
  Types: `PlanPrefs` (+ `Settings.plan`/`onboarded`), Routine gains
  `plan`/`weekday` (0=Sun). Store: `applyPlan` (buries old plan routines,
  writes new ones with per-set restSec, saves prefs, prefills kcalGoal per
  goal) and `ensureCatalog(dbId)` (extracted from startRecommended).
  `src/screens/Onboarding.tsx`: dark premium wizard (C.primary bg, lime
  accents) — welcome → "How do you measure?" (Metric kg·cm / Imperial
  lb·ft-in cards) → about-you (sex/weight/height/age, dark fields; imperial
  shows ft + in height fields, converted via `src/lib/units.ts` —
  `LB_TO_KG`/`ftInToCm`/`cmToFtIn`, deduped from calories/Profile) → goal →
  days → focus → pulsing-logo "building" theater → staggered plan-reveal
  cards. Profile's Body-profile height also switches to ft/in when the
  unit is lb (heightCm stays canonical in storage). Direction-aware StepSlide transitions;
  every choice step confirms with an explicit Continue button (auto-advance
  shipped first, Adilzhan vetoed it — you can't change your mind); Skip
  everywhere, hardware Back walks steps (first-run not dismissable),
  answers prefill from Settings on rebuild. GOTCHA (hit again): flex:1 on
  a Squish inside a row collapses it to 0 width — the days-per-week squares
  rendered as an empty page; wrap the Squish in a flex:1 View. Root shows it when `!settings.onboarded` (existing installs see
  it once) or via Profile's new "Training plan" card → Rebuild plan
  (`onRebuildPlan` prop).
- 2026-07-10: Home rebuilt as a day dashboard (nutrition-app reference from
  Adilzhan). New pieces: `DateRuler.tsx` — horizontal snap FlatList of day
  numbers (ITEM_W 54, window 365 days back, ending at today so the future
  is unscrollable), scroll-driven native interpolations (scale 0.72→1.25;
  ink layer crossfaded over a faint layer since text color can't animate
  natively), 5 tick marks per cell + fixed ▲ caret; exports `dayStart`/
  `addDays` (calendar-based math — adding 24h blocks drifts an hour across
  DST, caught by a scratchpad spot-check). `CalendarDialog.tsx` — custom
  calendar in CenterDialog: ‹month› stepper, tap title → month grid +
  ‹year› stepper, Mo–Su grid, black capsule selected / ringed today /
  future disabled. `charts.tsx` — `SegmentedBar` (barcode bars, animated
  width mask, fills lime at goal) and `ArcGauge` (SVG round-cap ticks on a
  270° arc, gap at bottom; animated counter sweeps ticks in; value/goal
  centered). Home: `day` state drives the goal card (BURNT/GOAL numbers,
  bar, gauges MINUTES orange / SETS teal / VOLUME purple) and the workout
  list (Today → recents, else that day's workouts); header PopIn-crossfades
  on date change; live session counts toward today. Settings gained
  `kcalGoal`/`activeMinGoal`/`setsGoal`/`volumeGoal` (defaults 300/60/25/
  8000 via `dailyGoals` in stats.ts; volumeGoal is in the display unit),
  edited in a Profile "Daily goals" card. The old Flame "Today" card is
  gone.
- 2026-07-10: Floating top bar — the dock's light twin. The in-flow
  logo/greeting/avatar row in App.tsx became an absolute pill (top 8,
  left/right 14, height 52, `C.surface`, radius 999, clay shadow; logo
  left, greeting centered, avatar right) so tab content scrolls under it.
  `TOP_BAR_SPACE` (60) in theme.ts = screen top → below the bar; every tab
  ScrollView and in-tab overlay (WorkoutSummary, ExerciseInfo,
  ExerciseBrowser toolbar — which also covers ExercisePicker) pads
  `TOP_BAR_SPACE + <old padding>`. Render order in Root: content → top bar
  → BottomNav → Profile, so the bar (like the dock) stays visible over
  in-tab overlays but Profile covers both. CAREFUL: overlays with a FIXED
  header outside their ScrollView (ExerciseInfo, ExerciseBrowser toolbar)
  need the TOP_BAR_SPACE padding on the HEADER, not the scroll content —
  ExerciseInfo shipped with it on the wrong one (header hidden under the
  bar, content double-spaced) and was fixed after Adilzhan hit it.
- 2026-07-10: WorkoutSummary compacted + ⋯ menu. All exercises now render
  in ONE Card (sections split by Divider, 1RM column label on the first
  section only; the old card-per-exercise ate too much space —
  `highlightExerciseId` now tints the section lime instead of ringing a
  card). The duration/volume/kcal/PRs stats bar sits ABOVE the exercises
  card (was a floating footer pinned over the navbar, per Adilzhan). Header gained a ⋯ button opening a CenterDialog menu (the app's
  shared animated dialog): Repeat workout (starts a fresh session from the
  workout's entries, all sets unticked, jumps to the Workout tab; disabled
  while a session is live), Save as routine (`saveRoutine` with unticked
  sets), Share workout (RN `Share` sheet — name, long date, stats line,
  per-exercise "N × name — top kg" lines), Delete workout (ConfirmDialog →
  `deleteWorkout` → close). `startWorkout` now stores
  `routineId: routine?.id || undefined` so repeating a quick-start workout
  (ephemeral routine with id "") doesn't stamp an empty routineId. Icon
  gained Share2.
- 2026-07-10: Strong-style exercise header in the live session — the trash
  button is gone, replaced by a focus-metric pill + a ⋯ menu (both
  anchored popovers, same Modal+PopIn+statusBarTranslucent pattern as the
  set-type menu, right-aligned under their buttons). Metric pill: shows a
  Waypoints icon until a metric is picked in the "Set a Focus Metric"
  dialog (Total Volume / Volume Increase / Total Reps / Weight/Reps —
  live values from `metricsFor` in Workout.tsx: done sets only, increase
  is % vs the most recent finished workout with that exercise, clamped to
  +0% until something is logged, top set for Weight/Reps); the pick is
  saved as `WorkoutEntry.focusMetric` (types.ts) so it persists/syncs;
  re-picking clears it. ⋯ menu is UI-only for now (Add note / Add sticky
  note / Add warm-up sets / Update rest timers / Replace exercise /
  Create superset / Preferences — lucide FileText, Pin, Diff, Timer,
  Undo2, List, SlidersVertical) EXCEPT Remove exercise (X, red), which
  routes to the existing ConfirmDialog since the trash is gone. Verified
  on the emulator end to end.
- 2026-07-10: Fixed the order/sort menu positioning on the Exercises page ([ExerciseBrowser.tsx](file:///home/wopler/dev/torq/src/components/ExerciseBrowser.tsx)) by shifting its absolute `top` coordinate by `TOP_BAR_SPACE` (setting it to `TOP_BAR_SPACE + 42` instead of hardcoded `42`). This positions the dropdown menu correctly under the Order button toolbar icon and prevents it from overlapping with/rendering under the floating top bar.
- 2026-07-10: Customized weight progression steps in the suggestion engine ([suggest.ts](file:///home/wopler/dev/torq/src/lib/suggest.ts)) based on equipment type. Added a dynamic `getWeightStep` helper that returns micro-loading steps (1 kg / 2 lb) for dumbbells, cables, kettlebells, and bands, while maintaining default steps (2.5 kg / 5 lb) for barbell/machine compound exercises. Integrated in `startWorkout` ([store.tsx](file:///home/wopler/dev/torq/src/lib/store.tsx)).
- 2026-07-11: Live-session set rows compacted (Adilzhan, three passes —
  gap-shaving alone read as no change; the space was the divider strip):
  final values: exercise Card gap 0, NO set-block gap, idle RestDivider is
  a fixed 12px-high strip (text 10), set row paddingVertical 1; the
  SET/PREVIOUS/KG/REPS header row carries its own marginTop 12 (room under
  the exercise-name pill, per Adilzhan) + marginBottom 3. Consecutive done
  sets sit flush as one tinted block, and a done set shows NO rest divider
  at all unless its countdown is actively running — idle "2:00" timers
  live under unfinished sets only. Verified on the emulator.
- 2026-07-11: Live-session done-set polish (Adilzhan): the RestDivider
  between two DONE sets is hidden (rest already happened; it stays while
  its countdown still runs, and at the done→open boundary), and the
  done-row tint lightened rgba(160,210,20,0.42) → 0.16 — the old wash
  read too heavy. Verified on the emulator.
- 2026-07-11: Live-session KG/REPS inputs select their content on every
  tap (`SetNumInput` in Workout.tsx now passes `selectTextOnFocus`
  unconditionally, not just for done-set re-edits) — prefilled values
  (suggestions, replays, plan reps) get replaced by typing instead of
  appended to. Verified on the emulator (tap → full-value selection).
- 2026-07-11: Plan-aware streaks (Adilzhan's idea, mechanics agreed in
  chat). `src/lib/streak.ts` — pure function of (workouts, plan routines):
  every day with a finished workout counts 1 (same-day sessions once,
  rest-day bonus workouts count), streak breaks after 3 CONSECUTIVE missed
  planned weekdays (scattered misses tolerated; a workout resets the miss
  counter), today's pending session isn't a miss, no plan → no streak.
  Longest tracked in the same pass. Verified with a 12-case table. UI:
  StreakPill next to Home's "Today" (lime = safe today, ink = today's
  session pending, orange warnSurf = at-risk after 2 consecutive misses,
  faint = broken; hidden without a plan) → tap opens a CenterDialog (flame
  count, since-date, at-risk warning, gold-trophy longest, rule sentence);
  Stats page gained a lifetime "current / longest streak" card under the
  overview row (not month-scoped). Verified on the emulator incl. dialog.
- 2026-07-11: Streak modal auto-pops once per trained day: Home effect —
  first visit after today's first FINISHED workout opens StreakDialog
  after 450ms; `Settings.streakCelebratedDay` (local-midnight ms, synced)
  marks the day so it never repeats. GOTCHA: don't clearTimeout in the
  effect cleanup — updateSettings changes a dep, re-runs the effect, and
  the cleanup would cancel the timer before it fired. The pill stays
  tappable for on-demand opens.
- 2026-07-11: CenterDialog gained an EXIT animation (Adilzhan: dialogs
  popped in but vanished instantly): one Animated.Value drives backdrop
  dim + card scale/fade both ways — backdrop tap plays a 150ms ease-in
  shrink/fade before calling onClose (guarded against double-close).
  Children that close the dialog themselves can use the new
  `useDialogClose()` context hook for the animated path — ConfirmDialog's
  Cancel/confirm buttons now do; menu rows that call their own setState
  still unmount instantly (adopt the hook when touching them). PopIn no
  longer used by Dialog.tsx.
- 2026-07-11: Streak dialog redesigned to a Duolingo-style celebration
  (Adilzhan's reference image): new `src/components/StreakDialog.tsx` —
  hand-authored Lottie flame (`assets/flame.json`, 2s loop: squash &
  stretch + rotation flicker anchored at the flame base, counter-phased
  amber mid + white core layers, two rising embers; played via
  lottie-react-native 7.x, bundled in Expo Go) inside a soft peach halo,
  giant count, "Day Streak", personalized encouragement (settings.name;
  at-risk variant in warnAcc), Monday-first week strip (orange
  LinearGradient check circles on trained days, plain day numbers
  otherwise, today bold), gold-trophy longest line. Home's old inline
  streak dialog replaced. NOTE: killing a Metro the app is attached to
  makes Expo Go show "Cannot connect to Expo CLI" — force-stop + reopen
  the exp:// URL. Verified on the emulator (two captures confirm the
  loop is animating).
- 2026-07-11: WorkoutCard restructured (Adilzhan's spec): pills row gone —
  top shows CalendarDays "Fri, Jul 10 · 18:57" + Clock duration; the
  exercise list sits between Dividers; bottom row is icon stats CheckCheck
  sets (goodAcc) · Scale volume (prAcc) · Flame kcal (warnAcc, hidden at
  0) · Trophy PRs (C.gold, hidden at 0, via computePRs against all
  workouts, memoized). Local IconStat helper. Verified on the emulator.
- 2026-08-04: Rank-redesign kickoff decisions locked by Adilzhan (via lavish
  plan review): hybrid rank engine (real percentiles + calibrated formula),
  friends-first social scope, FULL visual rebrand (new logo direction: sharp
  Greek tau τ, lime on near-black; app name stays torq), Phase 1 (rank engine
  + standards dataset + Ranks tab) approved to start.
- 2026-08-04: App font swapped Onest → Space Grotesk (first rebrand change,
  Adilzhan picked it from a 4-font lavish tryout of the Rank Card). Only
  App.tsx (useFonts) and theme.ts FONT tokens changed — every component
  reads FONT, so the swap is global. extrabold now aliases 700 Bold (family
  max). tsc clean.
- 2026-08-04: PATH.md created (business idea, rank-system design, locked
  decisions, 4-phase roadmap) so torq-local sessions carry the full product
  context; pointer added at the top of this file.
- 2026-08-06 (later): Home goal card replaced (Adilzhan: "showing calories
  is bad"; picked "A+C combined, kcal off Home only" from the lavish
  options page .lavish/torq-home-upgrade.html). The BURNT/GOAL kcal block
  + SegmentedBar + week ArcGauges are GONE from Home (kcal survives in
  WorkoutCard/summary/Stats; calories.ts untouched). In their place:
  (1) WEEK STRIP — Monday-first 7 dots for the selected day's week:
  trained day = lime check, today = lime ring, planned weekday = faint
  ring with date number, rest = dot; eyebrow "This week · X of Y done"
  (Y = plan sessions, fallback 3). (2) RANK MOMENTUM — RankBadge +
  points + "▲ +N this week" (overall pts now vs before this Monday —
  rankLifts on workouts ended before weekStart) + tier label + pts-to-
  next + progress bar + "Closest tier-up: <lift> — N kg from <tier>"
  via new rank.ts helpers `kgForPoints` (inverse DOTS) and
  `closestTierUp`. Verified on the emulator (strip checks, +2 delta,
  bench 5.3 kg from Silver).
- 2026-08-06 (later): Ranks TAB + shield badges in RN (from the approved
  brand-v2 mockup). `src/components/RankBadge.tsx`: react-native-svg port
  of the lavish badge generator — rounded-hex shield (Polygon + thick
  round-join stroke), tier metal LinearGradient frame (World Class =
  holo multi-stop), vortex emblem (VORTEX_PATH now exported from
  Logo.tsx) scaled into the shield, orbit ring as sampled half-ellipse
  Paths with a userSpaceOnUse Mask cutting the gap around each static
  jewel ball (RadialGradient + specular dot; no SMIL/filters in RN so
  no comet trails/blur — those stay web/share-card). Stage I–IV = ring →
  ball → two balls, derived from tier progress quarters (`stageOf` +
  `tierLabel` "Gold IV" in rank.ts). `src/screens/Ranks.tsx`: cardless —
  logo + "Ranks" + "NN kg · M/F" header, OVERALL row (badge + lime pts +
  tier label + pts-to-next + progress bar), LIFTS list (badge · name ·
  e1RM · tier label · pts). New "ranks" Tab (ui.tsx) second in the dock
  (Medal icon added to Icon.tsx). GOTCHA: module-level edits to
  BottomNav ITEMS didn't Fast-Refresh — force-stop Expo Go + reopen for
  a fresh bundle. Verified on the emulator with seeded data.
- 2026-08-06 (later): Rank engine v1 + Rank Card (PATH.md Phase 1 start,
  from the approved concept mockup). `src/lib/rank.ts`: pure functions —
  `dotsPoints` (official DOTS polynomial, sex+bodyweight normalized,
  bw clamped to the formula's valid range), 9-tier ladder on calibrated
  per-lift DOTS thresholds (Iron 30 → World Class 165; overall = ×3 on
  the sum of the TOP-3 lifts), `rankLifts` (best e1RM per exercise:
  finished workouts, no warmups, weight>0, reps 1–10; display-unit→kg
  via LB_TO_KG), `tierFor` (tier + toNext + progress), `overallRank`.
  Math spot-checked (mockup persona → 284 pts Gold; 60kg F ≈ 74kg M
  equivalence; WR bench → World Class). NO percentile claims by design
  until the OpenPowerlifting dataset ships. UI: `RankCard` in
  Profile.tsx above Settings (cardless): lime avatar initial + name +
  "NN kg · M/F" + translucent TierPill (TIER_COLORS/TIER_SHORT from
  rank.ts), big points + lime progress bar + "N pts to <tier>", BEST
  LIFTS top-3 rows (name · tier pill · e1RM), fine-print eligibility
  note; empty state before any eligible lift. Verified on the emulator
  with seeded data.
- 2026-08-06 (later): Floating top bar removed entirely (Adilzhan's
  request): App.tsx renders no bar; `TOP_BAR_SPACE` = 0 in theme.ts so
  every screen/overlay padding collapses (constant kept for easy revival);
  Profile now opens from a new fixed-width UserCircle icon button at the
  FAR RIGHT of the BottomNav dock (`BottomNav` gained an `onProfile`
  prop; plain Pressable, not a morphing tab — the overlay covers the
  dock). Verified on the emulator: header at top, dock button opens
  Profile.
- 2026-08-06 (later): Splash/icon config modernized: legacy app.json
  `splash` key replaced by the `expo-splash-screen` config plugin (SDK 57
  deprecates the old key; package installed — without it Metro dies with
  PluginError). GOTCHAS: (1) Expo Go shows the app ICON (not the splash)
  while loading a project, and it CACHES project icons — after changing
  icon.png, `adb shell pm clear host.exp.exponent` is the only reliable
  flush, BUT pm clear also wipes AsyncStorage = the app's whole local DB
  on that device. (2) After pm clear, bare `am start -a VIEW -d exp://…`
  may not resolve to Expo Go — append the package: `am start -a
  android.intent.action.VIEW -d "exp://10.0.2.2:8081" host.exp.exponent`.
- 2026-08-06 (later): CARDLESS + DARK migration shipped (Adilzhan approved
  via the lavish mockups, "start migrating screens"). theme.ts rewritten:
  clay palette → near-black rebrand (page #0E0F0E, surface #151714 for
  interactive/overlays only, page2 #1B1E1A inputs, ink #F2F4EE→inkSoft
  #9AA294→inkFaint #5C6356 steps, NEW C.line #262A24 borders + C.hair
  #22261F hairlines, dark good/warn/bad/pr surfaces, light chart palette,
  black shadows); global.css mirrored. ui.tsx: `Card` is now a TRANSPARENT
  padded block (explicit background restores a bordered box) — every old
  Card usage renders bare automatically; new `Surface` (old card look:
  surface bg + line border + clay) for dialogs/sheets; new `Eyebrow`
  (10px uppercase letterspaced label); Divider → C.hair; Pill defaults
  ink-on-page2; PrimaryButton defaults lime. Dialog.tsx uses Surface +
  black backdrop. App.tsx: top bar bordered, StatusBar light. Home.tsx
  rebuilt to the mockup (TodayHero = eyebrow + headline + lime Start
  pill per state; goal + sparkline sections bare; recents hairlined).
  Workout start screen: routine GRID replaced by cardless RoutineRow list
  (RoutineGridCard/TwoColumnGrid deleted); quick start is a bare row with
  a lime play chip; live-session exercise names are plain bold text (dark
  pill gone), done-tint now lime-on-dark. WorkoutCard → bare block
  (callers add Dividers). Selected chips (Stats measure kinds, Profile
  sex/unit, ExerciseInfo tabs) primary→lime. BottomNav: active capsule
  now a dark #2A2F27 chip with ink text (was white), dock bordered.
  CalendarDialog selection lime. DateRuler ticks + ProCharts grid/
  pointer/tooltip lines flipped to light rgba. Remaining screens go
  cardless automatically via the transparent Card; deeper per-screen
  typography passes can follow as they're touched. tsc clean + android
  export verified. NOT yet eyeballed on the emulator.
- 2026-08-06: New brand logo — the lime "vortex" mark (8 sharp blades
  spinning around a center; AI concept by Adilzhan, source
  `assets/torq_logo_v2.png`), replacing both the old pulse mark AND the
  planned sharp-tau direction (Adilzhan dropped the tau; PATH.md updated).
  Traced with potrace to one vector path: `Logo.tsx` rewritten (path in a
  1024 box under `<G transform="translate(0,1024) scale(0.1,-0.1)">` —
  potrace emits math-axis coords), `LOGO_BG` now `#0E0F0E`;
  `assets/logo.svg` redrawn; icon.png / splash-icon.png / favicon /
  android adaptive+monochrome icons regenerated via ImageMagick from the
  trace; app.json splash+adaptiveIcon backgrounds `#f1efe9` → `#0E0F0E`.
  Rank-badge design (lavish sessions, `.lavish/torq-rank-system.html` +
  `torq-brand-v2.html`): badge emblem is now the vortex; jewel-style orbit
  balls upgraded to comets (glow halo + tapered energy trail streaming
  behind the travel direction via animateMotion rotate="auto"; jewel core
  with radial gradient + specular dot + drop shadow; masked moving gap in
  the ring), laurel leaves redrawn as pointed blades (per Adilzhan's
  reference images). A silver crown above World Class was built then
  removed at Adilzhan's request — laurel only. tsc clean; badges not yet
  ported to RN.
- 2026-07-11: Implemented a month switcher on the Stats page ([Stats.tsx](file:///home/wopler/dev/torq/src/screens/Stats.tsx)). Users can click left/right arrows to switch months, with the right arrow disabled for the future (relative to the current real month). Overview cards (workouts, volume, sets, hours), weekly charts (custom Monday-start weeks that fall in the month), body weight trendline, and logged measurements list are all scoped/filtered to the selected month.


- 2026-08-08: Per-exercise rank page + world-record mentions (PATH.md Phase 1
  continued). New `src/data/records.ts` — bundled, versioned IPF Classic
  (raw) world-record table per sex and weight class for squat/bench/deadlift
  (`RECORDS_VERSION`, `RECORDS_VERIFIED = false`: the numbers are an
  APPROXIMATE snapshot and must be re-checked against the official IPF
  database before release). New `src/lib/records.ts` — `recordLiftOf(name,
  equipment)` maps a library exercise onto a competition lift with strict
  keyword exclusions (barbell only; variations like incline bench, front
  squat, RDL, JM press, Jefferson squat get NO record line rather than a
  misleading one — verified against the catalog: 13 of 1500 names match),
  `worldRecord(lift, sex, bwKg)` picks the weight class, `recordShare`.
  ExerciseInfo gained a "Rank" tab (tabs row is now a horizontal ScrollView
  since there are five): big RankBadge + tier label + DOTS points + progress
  bar + "N pts to <tier> — about N kg more on your best set" (via
  `kgForPoints`), then the world-record block ("41% of the 83 kg record",
  bar, source fine print) when the lift matches. The info header shows the
  tier badge (tap → Rank tab) whenever the lift is ranked, and `initialTab`
  lets callers open straight on it. Ranks-tab lift rows are now Pressable
  (chevron) and open that page. tsc + android export clean; NOT yet
  eyeballed on the emulator.
- 2026-08-08 (later): SHARP-10 radius system shipped app-wide (Adilzhan chose
  "Sharp 10 px" from the lavish review `.lavish/torq-radius.html`, which put
  today's pill look next to a live-adjustable preview of the same torq
  surfaces). `R` in theme.ts went `{lg:28, md:22, sm:16, pill:999}` →
  `{lg:16, md:12, ctrl:10, sm:8, pill:999}` (new `ctrl` token), mirrored in
  global.css. Every component already reads `R`, so the sweep was the audit
  of hand-written radii: pills that were really CONTROLS became tokens —
  ProCharts range/metric pills, Profile sex+unit chips, ExerciseBrowser
  filter chips + thumbnails, RoutineEditor Save, Stats measure chips, Home
  lime CTA + calendar button, Onboarding focus chips + icon tiles,
  ExerciseInfo tabs, Workout rest field / focus-metric pill / done check /
  rest-pad buttons / quick-start chip, the BottomNav dock (16) and its
  active capsule (10), Surface (dialogs) → R.lg, PrimaryButton → R.ctrl.
  Left fully round on purpose: status pills (ui.tsx `Pill`, TierPill,
  PrPill, StreakPill), true circles (avatar, week-strip dots, calendar days,
  streak halo, chart legend dots) and thin progress bars. tsc + android
  export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Live-session visual pass to the sharp-10 mock
  (Adilzhan liked the preview phone in `.lavish/torq-radius.html` and asked
  for the live screen to match; scope confirmed as a restyle, not new
  controls). `NumberField` gained a hairline `C.line` border so every input
  reads as a box on the bare page; a DONE set's KG/REPS keep that box
  instead of collapsing to bare text (same padding metrics, so ticking a set
  no longer jumps the row height) and its set number turns lime; FIELD_W
  50 → 54; PREVIOUS moved inkFaint → inkSoft 12.5; exercise names 16/bold →
  18/extrabold. `RestCountdownBar` rebuilt: 30px tall, R.ctrl corners, new
  `C.restTrack` (#26320C) for the spent side, and the "1:24" label drawn
  TWICE — lime on the track, dark inside an overflow-hidden copy of the
  draining fill (the fill's inner View is pinned to the measured bar width
  via onLayout, so the clipped label stays centered on the whole bar while
  its container shrinks). `PrimaryButton` gained `large` (15px padding,
  15.5px extrabold), used by Finish workout. tsc + android export clean;
  NOT yet eyeballed on the emulator.
- 2026-08-08 (later): World-record data replaced with SOURCED values. The
  first pass wrote the IPF table from memory and was off by up to 17 kg
  (men's 83 squat 337.5 → 320.5 actual), so `src/data/records.ts` was
  rebuilt from published record tables (garagegymreviews, checked
  2026-08-08) plus the 2026 Sheffield reports for the women's 84 kg squat:
  version `ipf-classic-2026.1`, `RECORDS_CHECKED_AT`, and every cell is now
  `{kg, holder} | null`. `worldRecord()` returns null for uncurated cells
  (seven women's SQUAT classes — that source duplicates its bench table
  there) so the Rank tab simply omits the record line instead of showing a
  wrong one. The mention now names the holder and the check date.
- 2026-08-08 (later): CARDLESS migration finished on the remaining screens
  (PATH.md Phase 2, "screen by screen"). The bug driving it: `Card` is
  transparent since the rebrand but still pads 16, so every Card inside an
  already-padded ScrollView double-guttered its content — charts and rows
  sat 32px from the screen edge while the page title sat at 16. Stats,
  History, Profile, ExerciseInfo, WorkoutSummary and RoutineEditor now use
  bare Views with `Eyebrow` section labels and hairline `Divider`s instead
  of Cards; `SectionTitle` survives only inside ExerciseBrowser's filter
  dialog/sheet (a true overlay). Screen specifics: Stats lost its surfaced
  month box for a bare "Stats + ‹ ›" header row with the month underneath,
  overview figures went 17px-in-a-box → 22px bare, streaks are a hairlined
  row; History separates workouts with Dividers (WorkoutCard has documented
  that contract since it went bare) and titles at 26; Profile's sections are
  hairline-separated and its two Stat figures went 20 → 24. `Card` itself
  stays for Workout.tsx's live-session exercise block, whose set rows
  full-bleed with marginHorizontal -16 against its padding. tsc + android
  export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Authentication gate shipped (Adilzhan supplied the
  live Supabase project + keys). See the new "Auth + secrets" section above
  for the .env split, the Metro cache gotcha and the guest escape hatch.
  New files: `src/lib/password.ts` (policy + strength meter, spot-checked
  against a 12-case table), `src/screens/Auth.tsx` (the gate),
  `SpinningLogo` in Logo.tsx (native-driver linear loop; spins fast while a
  request is in flight). `src/lib/auth.tsx` rewritten: guest mode persisted
  in AsyncStorage, `signUp` reports `needsConfirmation` when Supabase
  returns no session, more friendly error mappings. App.tsx holds one
  splash for "DB not ready OR session still restoring" so a signed-in user
  never sees the gate flash. Icon gained Eye/EyeOff/Lock/LockKeyhole/Mail/
  TriangleAlert. NOT DONE: `supabase/schema.sql` has NOT been applied — all
  six mirror tables 404 on the REST API, so sync will fail until Adilzhan
  pastes it into the SQL editor. This machine cannot reach the DB directly
  (db.<ref>.supabase.co resolves IPv6-only, "Network is unreachable") and
  the pooler host needs the project's region.
- 2026-08-08 (later): Phase 3 kickoff — social foundation shipped (see the
  "Social" section above): supabase/social.sql, src/lib/social.ts,
  src/screens/Friends.tsx, the You/Friends switch in Ranks, and a
  fire-and-forget snapshot publish inside the store's finishWorkout. The
  private mirror schema (schema.sql) was applied by Adilzhan — all six
  tables now answer 200 on the REST API. social.sql still needs the same
  paste; it has NOT been executed, so the Friends view will error until it
  is. tsc + android export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Phase 3 continued — social.sql applied by Adilzhan
  (profiles/friendships/rank_snapshots + find_profile all answer on the REST
  API). Added the friends head-to-head compare and the rank share card; see
  the "Social" section above for both. Structural fix along the way: Friends
  had been rendering inside the Ranks ScrollView, which would have made its
  overlays position against scroll content — Ranks now branches, giving the
  Friends view its own scroll root. Deps added: react-native-view-shot 5.1.0
  + expo-sharing (via `npx expo install`, so SDK-matched). tsc + android
  export clean; NOT yet eyeballed on the emulator — the share capture in
  particular is the one thing I cannot verify without running it.
- 2026-08-08 (later): Percentiles shipped — the hybrid rank engine is now
  whole (see "Percentiles + plausibility" above). Also added: plausibility
  caps on published snapshots, `rank_events` retention (each device prunes
  its own rows older than 90 days on publish — no cron job needed), and the
  rank-up feed section in Friends. Spot-checked the percentile curve: a
  125 kg bench at 83 kg bodyweight lands at the 49th percentile of
  competitive raw benchers, world records clamp at 99%, and the curve is
  monotonic across 20–300 kg. tsc + android export clean; NOT yet eyeballed
  on the emulator.
- 2026-08-08 (later): Percentiles surfaced beyond the Rank tab — each
  ranked competition lift on the Ranks tab now carries its "Stronger than
  N%" / "Top N%" line, and the rank share card gets a lime percentile chip
  for the user's strongest one (the single most postable line on it).
  Also verified the bundled IPF record table against the OpenPowerlifting
  dump: all 41 curated values are at or below the best IPF-raw result ever
  recorded in their class, 0 impossible entries. Deriving the records FROM
  the dump was tried and rejected — see PATH.md for why, so nobody repeats
  it. tsc + android export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Device-testing round on Adilzhan's phone. Four fixes.
  (1) The Android navigation bar was drawing over the app: only BottomNav
  compensated for the inset, so every OTHER bottom-anchored control — the
  rest-timer pad, the picker's "Add N exercises" footer, the new-exercise
  sheet — sat underneath it and couldn't be tapped. The root SafeAreaView
  now reserves `edges={["top","bottom"]}`, so nothing in the app can draw
  under the bar and every hardcoded paddingBottom stays correct; BottomNav
  dropped its own inset maths (it would have double-counted).
  (2) Accounts were unreachable in the EAS build — see the "Building (EAS)"
  section above for the .env/eas.json cause and the new loud banner.
  (3) Rank badges were far too small for the app's headline feature: the
  exercise Rank tab is now a centred 190px shield with the tier and points
  stacked under it (was a 92px thumbnail in a row), the Ranks tab overall
  shield is 170px centred, and per-lift rows, Home momentum, Friends rows
  and compare columns all scaled up.
  (4) Sounds shipped — see the "Sound" section above.
- 2026-08-08 (later): Keyboard handling — see the "Keyboard" rule above.
  `KeyboardAwareScrollView` + `useKeyboardHeight()` added and wired into
  every screen that holds an input: live session (KG/REPS + the rest
  editor), Auth (replacing its hand-rolled KeyboardAvoidingView), Profile,
  Stats, Friends, RoutineEditor, Onboarding's about-you step, and the
  new-exercise bottom sheet in ExerciseBrowser. tsc + android export clean;
  NOT yet eyeballed on a device.
- 2026-08-08 (later): Test suite added (see "Tests" above) — 128 vitest
  assertions across ten lib modules, plus the MAX_DOTS fix it caught.
- 2026-08-08 (later): Friend SEARCH replaced exact-handle-only discovery
  (Adilzhan's request mid-session). `search_profiles` RPC + trigram indexes
  appended to supabase/social.sql (re-run the file), `searchProfiles()` in
  social.ts, and a debounced (300ms) results list in Friends with a per-row
  Add button; people already in your list or with a pending request are
  filtered out. The handle-claim field still forces handle characters, but
  the search field does NOT sanitise input — otherwise a display name with a
  space is untypeable.
- 2026-08-08 (later): The live-session exercise ⋯ menu is no longer a set of
  dead stubs. Implemented: **Add note** (WorkoutEntry.notes — this session
  only) and **Add sticky note** (Exercise.notes — comes back every session;
  that split is the whole reason both exist), both rendered under the
  exercise header and tappable to re-edit; **Add warm-up sets**, which
  prepends a 40/60/80% ramp of the heaviest WORKING set, rounded to the
  bar's step and de-duplicated so a light top set doesn't produce three
  identical warm-ups (no-op on bodyweight); **Update rest timers**, one rest
  applied to every set of the exercise; **Replace exercise**, reusing the
  picker and keeping the set scheme. REMOVED rather than faked: "Create
  superset" (needs real grouping) and "Preferences" (never specified) — a
  menu item that does nothing is worse than no menu item. Store gained
  `updateExercise`.
- 2026-08-08 (later): Crash + data-loss hardening (see "Failure handling").
  Added ErrorBoundary (per-tab and app-wide) and fixed loadDB silently
  discarding a corrupt database — it now preserves the blob and warns.
- 2026-08-08 (later): Account deletion + data export shipped (see the Play
  requirement section above). supabase/social.sql gained
  `delete_my_account()`; db.ts gained `wipeLocal()`; store gained
  `exportLocal`/`wipeLocalData`.
- 2026-08-08 (later): Startup + search performance, measured before and
  after. (1) Catalog split (see "ExerciseDB catalog"): 289 ms → 86 ms of
  cold-start work. (2) Search: the browser rebuilt each row's haystack —
  array alloc + join + toLowerCase over 1500 rows — on EVERY keystroke.
  `haystack()` now precomputes it once when the list is built and
  `matchesText()` takes pre-tokenized input, so 8 keystrokes over the full
  catalog went 17.3 ms → 1.1 ms. (3) The list was ALREADY virtualized (a
  SectionList with tuned windowing), so nothing was needed there — worth
  recording so nobody "optimizes" it again.
- 2026-08-08 (later): Women's squat record gap — searched again for an
  authoritative per-class source and found none that meets the bar (one
  aggregator declares its numbers "approximate" with no holders or dates;
  the OpenPowerlifting route was already rejected). Rather than invent
  numbers, the Rank tab now states explicitly when torq has no verified
  record for that class, so the blank reads as our data gap instead of "this
  lift has no record". `weightClassOf()` added to records.ts for that
  message. Filling it properly is a manual task against the official IPF
  database.
- 2026-08-08 (later): The Arena shipped (PATH.md Phase 4) — see the section
  above. Re-run supabase/social.sql: it gained profiles.arena/.verified and
  the two arena RPCs. Regional boards remain TODO (no country is collected).
- 2026-08-08 (later): Freemium groundwork shipped (see "Entitlements /
  paywall"): entitlements.ts, Paywall + LockedPanel, gates on
  Ranks/Friends/Arena/share cards, a dev Pro toggle, and 8 tests pinning the
  promises (logging and backup stay free, nothing is both free and paid,
  unlock() refuses honestly instead of pretending).
- 2026-08-08 (later): Push notifications wired end to end in code (see the
  section above) — client token registration, push_tokens table, and the
  notify Edge Function for friend requests and friends' rank-ups. NOT LIVE
  until the FCM credentials, function deploy and two webhooks are done.
- 2026-08-09 (later): RANK BADGE ANIMATED + THE TIER LADDER (Adilzhan: show
  the badge bigger, animate the orbit on every tier and not just World
  Class, and list the tiers with the points each needs, "like in games, so
  they are disabled, but user can see how they look like").
  `RankBadge` now has TWO render paths and the split matters: STATIC (the
  default) is the old single-SVG badge with the balls parked and the ring
  masked around them — list rows keep it, because Ranks draws 8 lift rows,
  Friends draws a row per friend and none of them should pay for motion
  nobody is watching. ANIMATED (`animated` prop) actually orbits. RN has no
  SMIL, so one looping Animated.Value drives translateX/translateY/scale/
  opacity through interpolation tables sampled off the tilted ellipse, all
  on the NATIVE driver — the motion never touches the JS thread while you
  scroll. Z-ORDER IS FAKED: each ball is drawn TWICE, once under the shield
  and once over it, cross-fading between the copies at the ellipse's left
  and right extremes where the ball is clear of the shield and the swap is
  invisible. The balls are plain Views, not SVG circles — at ~12 px a fill
  plus a specular dot is indistinguishable from the radial gradient and
  costs a fraction of the nodes. The animated path drops the ring's mask gap
  on purpose: an opaque ball riding over a continuous ring reads as "in
  front" by itself, and animating the mask would need JS-driven SVG props.
  The Ranks hero went 170 → 248 px with negative vertical margins, because
  the artwork only occupies y 25–104 of the 136-unit viewBox and at that
  size the empty bands are ~45 px at each end.
  NEW `src/components/TierLadder.tsx`: all nine tiers as a 3×3 board.
  Earned = full colour and orbiting; current = lime frame; LOCKED = the real
  badge art at 45% opacity with a lock and the points still needed — not a
  silhouette and not a "?", because the entire point is seeing what Diamond
  looks like while you are still Silver. Motion is the reward: locked badges
  stand still. Verified on the emulator by capturing three frames 1.4 s
  apart and montaging them — the ball visibly crosses in front of the
  shield.
- 2026-08-09 (later): STATS REBUILT as "the climb" (Adilzhan: "I don't like
  that it shows the volume, not rank advancement, or weight increasing in
  exercises" — he picked idea 1 plus the dumbbell chart from idea 2 in the
  lavish review `.lavish/torq-stats.html`, which embeds real screenshots of
  the old page rather than a mock of it).
  The old page led with "29k VOLUME (KG)" and its biggest chart was weekly
  volume, above a near-identical weekly workout-count chart, four of whose
  six slots were empty. Volume measures how much work you did; it rewards
  long sessions, not strong ones.
  NEW `src/lib/progress.ts` (pure, 16 new tests): `rankHistory` replays DOTS
  points across a window — the running best-per-exercise map is advanced
  through the workouts ONCE rather than recomputed per sample, because the
  naive version is quadratic and this runs on every render — and reads
  BODYWEIGHT PER SAMPLE, since DOTS divides by it and a fixed weight would
  draw a flat line over a real decline. `liftMovement` gives each lift's
  best e1RM then vs now (a debut starts at its first value, not zero, or the
  chart would claim a jump that never happened). `recentRecords` is the PR
  feed, and a lift's FIRST appearance is deliberately not a record.
  NEW `src/components/ProgressCharts.tsx`: `RankLine` (one series =
  emphasis, so no legend and exactly ONE direct label; tier bands are an
  ordinal ramp at 6% alpha; the window always leaves the band ABOVE enough
  height to carry its own name, because that band is the target) and
  `Dumbbell` (before → after per lift; one hue in two treatments, hollow =
  then, filled = now, so a row with no gap reads as a stall).
  Extracted `src/components/SubPage.tsx` from Settings so Stats and Settings
  share one sub-page frame and one back-handling story.
  TWO CHART BUGS fixed on the device in the same pass: `MuscleBreakdown`'s
  RAMP was `rgba(26,27,26,…)` — near-BLACK, left over from the light clay
  theme — so on the #0E0F0E cardless page every segment was invisible and
  the bar rendered as an empty grey strip beside a legend of percentages;
  it is now a validated ordinal ramp for a dark surface (monotone lightness,
  ΔL ≥ 0.06 per step, 2.17:1 at the dim end). And dropping the empty weekly
  buckets turned a sparse chart into a ONE-BAR bar chart, so the weekly bars
  now need two weeks before they draw at all — one bar is not a chart, it is
  the figure already printed above it.
- 2026-08-09 (later): FIRST EMULATOR RUN since the push work — the app did
  not load at all. Red box: "[runtime not ready]: expo-notifications:
  Android Push notifications … was removed from Expo Go with the release of
  SDK 53", thrown from `addPushTokenListener` during module require. See the
  rule at the top of "Push notifications" above; fixed by loading the
  package lazily. Two visual fixes found in the same pass: Profile's lime
  avatar ring around the lime no-photo avatar read as one blob (the ring now
  only frames an actual photo), and Home's week strip could print an
  impossible "4 of 3 done" (it now says "4 done · 1 above plan" once you
  pass the target). Verified on the emulator: Home, Ranks and the new
  Profile all render, and the five-tab dock behaves.
  `supabase/social.sql` was then applied from this machine over the session
  pooler (see "Auth + secrets") and verified: `profiles.avatar_url` exists,
  the public `avatars` bucket and its four folder-scoped storage policies are
  in place, and `handle_taken` is granted to `anon`. The Friends view's
  "column profiles.avatar_url does not exist" banner is gone and it reads the
  handle again.
- 2026-08-09 (later): PROFILE split into an ATHLETE CARD + a SETTINGS HUB
  (Adilzhan picked "idea 1 with a settings page built like idea 2" from the
  lavish review `.lavish/torq-profile.html`). The old page was four screens
  in one ~2 400 px scroll: identity, a full rank card, every setting, and
  account deletion.
  `Profile.tsx` now has one job, "who am I here": centred avatar in a lime
  ring (tap to edit), name, @handle (from `myProfile()`), body line and
  "lifting since <month year>" (derived from the earliest workout, so it
  stays true for imported history); a rank STRIP with a 64px shield that
  SUMMARISES and links to the Ranks tab instead of repeating its 168px
  shield; workouts / volume / day-streak; best lifts with tier + percentile;
  Share (wired to the existing `ShareRankCard`, which had no button anywhere
  near this page) and Edit profile; then three quick links — Friends,
  Training plan, Settings.
  NEW `src/screens/Settings.tsx` is the grouped hub. Its rule: EVERY ROW
  SHOWS ITS CURRENT VALUE, so "what unit am I on" is answered by scanning,
  not tapping. Single-switch controls (units, sound) stay inline; anything
  with more than one field opens a `SubPage` (body profile, daily goals,
  account, your data, developer) — plain `sub` state plus a shared frame,
  not a router. Developer tools are now two taps off the main path instead
  of sitting under a real user's history.
  Also: the Ranks You/Friends/Arena segment moved from Ranks' local state
  into `useUi` (`ranksView` + `openRanks(view)`), so Profile's Friends row
  can deep-link straight to the Friends segment. `Icon` gained Camera and
  UserRound.
- 2026-08-09 (later): BOTTOM NAV redesigned — "Five, spelled out" (Adilzhan
  picked it from the lavish review `.lavish/torq-navbar.html`, which put the
  current morphing dock next to three interactive alternatives). The
  diagnosis was measured, not guessed: on a 360 dp screen the dock's 6 tabs
  plus the profile button shared 274 dp, and with the active tab at 2.6x the
  flex of the others an IDLE tab was ~36 dp — under Android's 48 dp minimum
  touch target, unlabelled, and it slid sideways on every tap. Now:
  FIVE fixed fifths (~70 dp) that never resize, each with its NAME under the
  icon, active = lime + a 3px rail on the dock's top edge (scaleX + opacity,
  so the only animation left runs on the native driver and touches no
  layout), and Profile as the fifth slot rendered with the user's AVATAR
  instead of a generic glyph. Dock height 62 → 64.
  History and Exercises LEFT the dock and became sub-pages: History opens
  from Home's "Recent workouts · See all" and has a back chevron plus a
  hardware-back handler to Home; Exercises opens from a new "Exercise
  library" row on the Workout tab and passes ExerciseBrowser's existing
  `onBack`. `PARENT` in BottomNav keeps the parent tab lit while a sub-page
  is open, so the dock never shows nothing selected. Options B (centre lime
  action button) and C (adaptive session bar) are described in the artifact
  if the workout-first direction is ever wanted.
- 2026-08-09: Four requested changes (Adilzhan).
  (1) PROFILE PICTURES — `src/lib/avatar.ts` + `src/components/Avatar.tsx`.
  expo-image-picker (config plugin added to app.json). The picture is kept
  on the PHONE first (copied out of the picker cache into the document dir,
  `Settings.avatarUri`) and uploaded second (`Settings.avatarUrl` +
  `profiles.avatar_url`), so a guest gets an avatar too and a failed upload
  never costs the user their choice; display order is avatarUrl → avatarUri
  → lime initial, with `onError` falling back so a stale URI renders as the
  initial rather than an empty hole. Filenames and the public URL carry a
  timestamp because expo-image caches by URI — reusing one path would keep
  showing the old picture. Storage bucket `avatars` is public with
  folder-scoped writes (`<user_id>/avatar.jpg`), so nobody can overwrite
  someone else's face. Friend rows show the avatar next to the shield.
  (2) PROFILE RANKS ARE BADGES, not "GOLD"/"SILVER" chips: TierPill is gone
  from Profile — the overall rank is a 168px shield with the tier named
  underneath, and each best-lift row carries its own 52px shield. Identity
  (avatar + name + body line) moved OUT of RankCard into its own row above
  it, so a user with no ranked lift yet still has a face and a name.
  (3) HISTORY SEPARATION — the real cause was WorkoutCard ruling off its own
  sections with the SAME hairline the caller uses BETWEEN cards, so a list
  read as one continuous striped block. The card's two internal Dividers are
  gone (grouping is spacing + type weight now), its title went 15/bold →
  16/extrabold, and the only rule left on the page is the one that ends a
  workout.
  (4) USERNAME ON REGISTER — the Create-account tab asks for a handle with a
  debounced live availability check. `handle_taken` is now granted to `anon`
  as well (rewritten so its "not me" clause doesn't drop every row when
  auth.uid() is null) because there is no session yet on that screen. Since
  sign-up returns NO session (email confirmation is on), the name is parked
  in AsyncStorage by `rememberSignupHandle()` and claimed by
  `claimPendingHandle()` from an effect in AuthProvider on the first session
  that appears — which may be minutes later, after the confirmation link. It
  publishes (`visible: true`): asking for a username and saying "this is how
  friends find you" IS the opt-in. RE-RUN supabase/social.sql for the avatar
  column, the storage bucket/policies and the new grant.
- 2026-08-08 (later): Play launch pack written (docs/launch/) — privacy
  policy, a data-safety answer sheet verified against the schema, store
  listing copy, and the ordered launch playbook. Key scheduling finding:
  the 12-tester/14-day closed test and pre-registration both have hard
  waiting periods, so they gate the date more than the code does.
