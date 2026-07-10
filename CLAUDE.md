@AGENTS.md

# Torq

Personal workout-session tracker (inspired by https://www.strong.app/), built by
Adilzhan. Android-first Expo React Native app. Repo: github.com/adilzhanY/torq.

**Living context file:** update this file after every user-requested change so
the next session knows where the project stands.

## Stack

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict)
- NativeWind v5 (preview) + Tailwind CSS v4 + react-native-css 3 — CSS-first
  config, no babel plugin. `lightningcss` is pinned to 1.30.1 via npm
  `overrides` (1.32 breaks CSS deserialization in the nativewind metro
  transformer).
- Supabase for auth + cloud sync (optional; app is fully offline-capable)
- lucide-react-native icons, Onest font (@expo-google-fonts/onest)
- No router: single-screen shell with a tab switcher (`src/lib/ui.tsx`),
  same as grit mobile.

## Design

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

Five tabs: Home (default) · History · Workout · Exercises · Measure. Profile
is NOT a tab — it opens as a full-screen overlay from the avatar button on
the top bar's right. Home is a dashboard: a "Today" calories-burnt card
(Flame icon, includes the live session), this-week stat cards (workouts /
sets / volume), a dark CTA that jumps to the Workout tab (turns lime
"Workout in progress" while a session is live), and the 3 most recent
workouts as WorkoutCards opening WorkoutSummary. The Workout tab is
quick-start + the user's routines + a
"Recommended" section (3-card push/pull/legs split from
`src/lib/recommended.ts`, exercises referenced by ExerciseDB `dbId`), and
becomes the live set-logger while a session is active (`activeWorkout` in
the store). `startRecommended` in the store imports any missing catalog
exercises into the library, then opens a session with sets prefilled at the
template's target reps.

## Commands

- `./run_android.sh` — one-shot run: boots the `torq` AVD if needed (handles
  `ANDROID_AVD_HOME`, `-gpu host`), then `npx expo start --android`. Preferred
  way to run the app.
- `npm start` / `npm run android` — dev server
- `npm run tsc` — typecheck (keep this clean)
- `CI=1 npx expo export --platform android` — verify the bundle compiles

## Dev environment (this machine)

Android tooling lives user-locally (no root): JDK 21 at `~/.local/jdk`,
Android SDK at `~/Android/Sdk` (platform-tools, emulator, android-36 image).
AVD `torq` (Pixel 7) is at `~/.config/.android/avd` — the emulator only finds
it with `ANDROID_AVD_HOME=~/.config/.android/avd` exported. Launch:
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
