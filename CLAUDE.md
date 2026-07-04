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
Default exercise library seeded on first launch from `src/lib/seed.ts`
(stable ids so multi-device seeds merge cleanly).

## Screens (`src/screens/`, tabs in `src/components/BottomNav.tsx`)

Strong-style five tabs: Profile · History · Workout (default) · Exercises ·
Measure. The Workout tab is quick-start + routines list, and becomes the live
set-logger while a session is active (`activeWorkout` in the store).

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
