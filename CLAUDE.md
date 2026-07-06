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

Strong-style five tabs: Profile · History · Workout (default) · Exercises ·
Measure. The Workout tab is quick-start + the user's routines + a
"Recommended" section (3-card push/pull/legs split from
`src/lib/recommended.ts`, exercises referenced by ExerciseDB `dbId`), and
becomes the live set-logger while a session is active (`activeWorkout` in
the store). `startRecommended` in the store imports any missing catalog
exercises into the library, then opens a session with sets prefilled at the
template's target reps.

## Commands

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
