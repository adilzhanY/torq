# Torq history

The full dated changelog, moved out of CLAUDE.md on 2026-08-17 so that file stays
under the 150k context limit. Nothing here was deleted, only relocated. The rules
and architecture notes still live in CLAUDE.md; this file is the record of how each
one was arrived at.


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
  in `docs/screens/`. SUPERSEDED 2026-08-10 by the generated product page,
  see the "Screenshots + the README product page" section.
- 2026-07-05: Full ExerciseDB catalog (1500 exercises, gif demos) integrated,
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
- 2026-07-05: Added 3 recommended routines (Push/Pull/Leg Day, a 3-day
  split) to the Workout tab with gif thumbnails and set×rep schemes;
  starting one auto-imports its exercises and prefills the live session.
  Verified on the emulator.
- 2026-07-06: Strong-style live-session upgrades in `Workout.tsx`
  (ActiveSession): elapsed workout timer in the header (1s ticker via
  `useNow`); rest timer, every set row has a `RestDivider` showing the
  planned rest (`settings.restSec`, default 2:00) that turns into a lime
  countdown progress bar when its set is checked (tap to skip, vibrates on
  finish; one active rest at a time, local state only); PREVIOUS column
  showing last performance per set index from the most recent finished
  workout containing that exercise (column hidden entirely for first-time
  exercises); tapping a set number opens a set-type menu (Warm up W orange
  `C.warnAcc`, Drop set D purple #7c5cd6, Failure F red `C.badAcc`), typed
  sets show the colored letter instead of a number, normal-set numbering
  skips them, re-picking the active type reverts to normal. Set rows got a
  Strong-style SET/PREVIOUS/KG/REPS header row (unit from settings).
  Verified on the emulator.
- 2026-07-06 (later): live-session polish, tapping an idle rest divider
  pops open (PopIn) an inline per-set rest editor, an ATM-style masked
  m:ss duration input (Adilzhan's preferred pattern; reworked from a plain
  seconds field): always displays m:ss, digits push in from the right
  (2 → 0:02 → 0:20 → 2:00), and once all 3 slots are filled new digits
  shift the seconds only, minute locked (2:00 + 3 → 2:03 + 0 → 2:30).
  Implemented as a formatted Txt over a hidden TextInput holding the raw
  digit buffer; prefilled value shows a fake lime "selected" highlight
  until the first keystroke replaces it (`selectTextOnFocus`). Commit on
  enter/blur, clamped 5-599s; saved as `WorkoutSet.restSec` (optional
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
- 2026-07-06 (later): tapping the running rest bar no longer skips, it
  toggles a Strong-style control pad. NOT a Modal: a Modal clipped its
  bottom rows on this emulator (content rendered partly below the window),
  so the pad is an inline overlay inside ActiveSession's root View:
  full-width, `bottom:0`, top-rounded, `paddingBottom:96` so it slides up
  from behind the BottomNav (custom `SlideUp` translateY spring, not
  PopIn). ActiveSession's root is now a flex-1 View wrapping the
  ScrollView. Grid layout per Adilzhan's sketch: full-width Pause/Resume
  on top (rest state gained `paused`/`pausedMs`; bar freezes with a pause
  icon), below it ONE row, all height 56: square 64-wide + / − (±20s via
  `bumpRest`, ending the rest at zero) then SKIP and RESET splitting the
  remaining width (SKIP clears rest and focuses the next set's weight
  input via the `weightRefs` map; RESET stops the rest and reopens that
  set's inline seconds editor via an `editNonce` prop). Gotcha: Squish
  applies `style` to its inner Animated.View, so `flex:1` on a Squish
  does nothing in a row, wrap it in a flex-1 View. Icon gained `Minus`.
  Verified on the emulator.
- 2026-07-06 (later): rest countdown is now a Strong-style tall bar
  (`RestCountdownBar`): 40px lime bar that starts full and drains leftward
  in one continuous `Animated.timing` (linear, driven by `endsAt`, width
  interpolated 0-100%), remaining time centered on it, PopIn entrance, tap
  to skip. The set-type menu is an anchored popover: opens at the tap's
  pageX/pageY (`animationType="none"` + PopIn, flips above when near the
  screen bottom) instead of a centered modal. Verified on the emulator.
- 2026-07-06: Exercise search is now token-based (`matches()` in
  `src/screens/Exercises.tsx`): every query word must appear somewhere in
  name/bodyParts/equipment/targetMuscles, any order, "bicep curl" finds
  "Cable Lying Bicep Curl" etc. Catalog results rank name-matches above
  muscle-only matches. Also enabled the hardware keyboard on the `torq` AVD
  (`hw.keyboard = yes` in its config.ini + device setting
  `show_ime_with_hard_keyboard 0`) so you can type in the emulator with the
  host keyboard.
- 2026-07-07: Added `run_android.sh` (see Commands), single script to boot
  the emulator if needed and start Expo; Adilzhan runs it himself, so don't
  spend turns launching the app manually.
- 2026-07-07: Strong-style "Add exercises" picker
  (`src/components/ExercisePicker.tsx`), replacing the old bottom-sheet
  picker in the live session. Full-screen inline overlay (NOT a Modal,
  the emulator Modal-clipping gotcha) over ActiveSession, listing the
  library merged with the whole ExerciseDB catalog (imported dbIds
  deduped; catalog rows import on add). Toolbar: Search (toggles the
  token-search field; `matches()` moved to `src/lib/search.ts`, shared
  with the Exercises tab), Filter (centered dialog, multi-select body
  part + category chips, live match count in the title, funnel icon gets
  a lime badge when active), Order (anchored popover: Name → letter
  sections / Frequency → Strong buckets "26+ / 11-25 / 6-10 / 1-5 times /
  Not performed" with per-exercise session counts / Last performed →
  recency buckets), Plus (bottom-sheet "New exercise" form, name +
  chips; saving auto-selects the new row). Rows multi-select (lime tint)
  into an "Add N exercises" CTA that appends all picks to the session.
  `addExercise` in the store now returns the created row; `SlideUp` moved
  to `components/anim.tsx`; hardware Back peels overlays then closes.
  Gotcha hit while verifying: after Metro restarts, Expo Go happily keeps
  running its cached JS, `adb shell am force-stop host.exp.exponent`
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
  the new `highlightExerciseId` prop. That exercise's card gets a light
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
  opacity ramp) in parallel, so the capsule reads as sliding between tabs.
  Motion is a 260ms Easing.out(cubic) TIMING, not a spring: spring
  overshoot fed the unclamped flex interpolation below its floor, making
  the deflating tab dip narrower and wobble ("old icon drags"); all
  interpolations are also clamped. useNativeDriver:false (flex is layout).
  No + button by design. Verified on the emulator.
- 2026-07-09: Shared centered dialog (`src/components/Dialog.tsx`):
  `CenterDialog` (dim backdrop + PopIn Card, tap-outside dismiss: the
  Filter-dialog pattern extracted; inline overlay, NOT a Modal, so mount it
  inside a flex-1 screen root) and `ConfirmDialog` built on it (title,
  optional message, Cancel / red confirm-then-close). ExerciseBrowser's
  filter dialog now uses CenterDialog, and every destructive action
  confirms via ConfirmDialog: removing an exercise from a live session
  (the previously unguarded trash button), deleting a routine (Workout
  start screen), a workout (History), a measurement (Measure, its root
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
- 2026-07-10: Animated "Add set", new `GrowIn` primitive in
  `components/anim.tsx`: mount entrance that grows the content in from zero
  height (220ms ease-out) while fading/sliding it down, then releases the
  clip once settled so later inner layout changes flow naturally. GOTCHA:
  the inner content must be `position: absolute` while animating (same
  trick as Collapsible), inside the 0-height clipped parent a normal-flow
  child lays out at height 0 on Fabric, so onLayout never reports a
  measurable height and the content stays invisible; it returns to normal
  flow on settle (no remount, style-only change). In Workout.tsx only sets
  appended via the Add set button animate: their "ei-si" keys go into the
  `grownSets` ref and the set block wrapper picks GrowIn vs View off it,
  restored sessions and last-time prefills mount statically. Verified on
  the emulator via screenrecord frames (grow + fade visible, settled state
  correct).
- 2026-07-10: Set-type menu anchored to the set number. It now anchors to
  the number element's page origin (pageX/Y − locationX/Y from the touch
  event) instead of the finger position, offset −16 horizontally so the
  W/D/F letter column sits exactly under the number, top just below the
  row. GOTCHA fixed along the way: the app is edge-to-edge but a plain
  Android Modal's window starts below the status bar, so pageY-anchored
  children rendered ~a status bar (~43dp) too low, `statusBarTranslucent`
  on the Modal aligns the two coordinate spaces. Verified with exact-tap
  screenshots.
- 2026-07-10: Calorie estimation (`src/lib/calories.ts`), built on the
  personal Mifflin-St Jeor BMR (weight/height/age/sex → resting kcal).
  Three per-completed-set components; the wall clock is ignored ENTIRELY,
  per Adilzhan, activity only (v1 billed idle-session time: one light set
  showed 186 kcal; v2 capped billing at elapsed time, which crushed
  workouts backfilled from another app in minutes: a real 22-set session
  showed 89 kcal): (1) lifting work 0.008 kcal per kg·rep (physics +
  ~20-25% muscle efficiency + eccentric; set weights converted from the
  display unit; bodyweight-equipment exercises add 0.6× body mass to the
  load), (2) work time ~15s + 4s/rep at Compendium METs (resistance 3.5 /
  olympic 6 / cardio 7), (3) planned per-set rest (set override or
  `settings.restSec`, clamped 30-240s) at 1.8 MET. 0 done sets → 0 kcal;
  backfilled and live sessions bill identically. Sanity: ~10 kcal for one
  70kg×5 set, ~246 kcal for a 22-set ~7000kg session. `Settings` gained optional
  `sex`/`birthYear`/`heightCm`/`weightKg` (ride along in sync; edited in a
  new Profile "Body profile" card, weight entered in the display unit,
  stored in kg). Effective weight prefers the latest Measure-tab "Body
  weight" entry at/before the workout (`bodyProfileAt`), so history
  reflects weight at the time; missing fields fall back to
  75kg/175cm/25/male with `complete:false`, which Home surfaces as a "set
  your body stats in Profile" hint. Shown as a Home "Today" card (finished
  workouts today + live session, Flame on lime) and a 4th Flame stat in
  the WorkoutSummary footer (footer text 13px / padding 14 to fit four
  stats).
- 2026-07-10: WorkoutCard's date pill now includes the completion time,
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
  yAxisOffset, sparse date labels, HOLD-to-inspect tooltip (a dark pill
  reading "Mon, 1 Jun · 79 kg" in lime, pointerConfig with
  activatePointersOnLongPress so scrolling isn't hijacked) and an
  optional reference line; GOTCHA: referenceLine1Position takes the RAW
  value, gifted subtracts yAxisOffset itself, pre-subtracting made the
  line invisible), `ProBars` (rounded bars, top value labels, lime
  highlight, maxValue pinned ~1.2× data max, the auto axis leaves short
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
  profile avatar), toggle it off in the Expo dev menu when driving the
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
  with a per-exercise ⋯ menu (Replace exercise, which opens the
  ExercisePicker in single-swap mode and keeps the set scheme, plus
  Remove exercise) and an
  Add-exercises footer (multi picker, new entries 3×10). Back cancels,
  Save commits via saveRoutine (plan/weekday preserved). Verified on the
  emulator: grid, menu, editor, exercise menu.
- 2026-07-10: Start-Workout routines as a 2-column grid (Adilzhan's spec):
  shared `RoutineGridCard` in Workout.tsx, fixed 168px height, no gifs,
  name + up to 4 "N × Exercise" lines (sets count only, no reps), "· · ·"
  overflow row, small trash for user routines; whole card tap starts the
  routine. `TwoColumnGrid` chunks cells into flex rows (flex:1 wrapper
  Views: the Squish gotcha again). Applies to user/plan routines AND
  Recommended (old RecommendedCard with gif thumbnails + Start button
  deleted). Verified on the emulator.
- 2026-07-10: History grouped by month (Strong-style, Adilzhan's request):
  month name left + "N workouts" right per section, newest first; months
  outside the current year render as "July 2025". The old flat
  "N workouts" SectionTitle is gone. Verified on the emulator.
- 2026-07-10: Suggested next weights (roadmap task 4).
  `src/lib/suggest.ts`, double progression: every top-weight working set
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
  routines; fallbacks 3/60/180 when plan-less), typed
  activeMinGoal/setsGoal/volumeGoal fields DELETED from Settings (never
  released; kcalGoal survives, Profile's Daily-goals card is now
  calorie-only), `dailyGoals()` → `kcalGoal()` in stats.ts. plan.ts gained
  `routineMinutes`/`routineSets` (verified to agree with planDayMinutes);
  charts.tsx gained `Sparkline` (7-day volume teaser card ending at the
  selected day, ink polyline + lime end dot). planWizard state moved into
  `useUi()` (openPlanWizard/closePlanWizard) so Home's no-plan hero and
  Profile's Rebuild plan share it; Icon gained Moon (rest-day hero).
- 2026-07-10: Training plan + onboarding, the "coach, not notebook" pivot
  (Adilzhan's direction: differentiate from Strong; roadmap lives in the
  session task list: next are Home plan-hero, suggested weights, Progress
  tab). `src/lib/plan.ts`: deterministic generator, the user picks CONCRETE
  training weekdays (2-6, Monday-first day-row list in onboarding, max 6 so
  one rest day survives; `PlanPrefs.weekdays`, 0=Sun); the count picks the
  split (2 FB A/B · 3 PPL · 4 UL×2 · 5 PPL+UL · 6 PPL×2 with B-variants)
  and templates zip onto the chosen days via `mondayFirst()`. Verified over
  all 1428 goal×weekday-subset×focus combos (0 problems),
  goal picks schemes (muscle 4×8/3×12 · lean 3×12/3×15 · fit 3×10/3×12 ·
  strength runs mains-first: first 2 compounds 5×5×180s, rest 3×8, flat
  5×5 made 2-hour sessions, caught by the exhaustive spot-check), focus
  parts get +1 set + unlock a per-day extra slot, days trimmed from the
  tail to a 90-min cap. Exercises referenced by VERIFIED dbIds (snapshot
  names have mojibake, e.g. "sled 45в° leg press", never match by name);
  missing ids skip. Verified: 160 goal×days×focus combos, 0 problems.
  Types: `PlanPrefs` (+ `Settings.plan`/`onboarded`), Routine gains
  `plan`/`weekday` (0=Sun). Store: `applyPlan` (buries old plan routines,
  writes new ones with per-set restSec, saves prefs, prefills kcalGoal per
  goal) and `ensureCatalog(dbId)` (extracted from startRecommended).
  `src/screens/Onboarding.tsx`: dark premium wizard (C.primary bg, lime
  accents), welcome → "How do you measure?" (Metric kg·cm / Imperial
  lb·ft-in cards) → about-you (sex/weight/height/age, dark fields; imperial
  shows ft + in height fields, converted via `src/lib/units.ts`,
  `LB_TO_KG`/`ftInToCm`/`cmToFtIn`, deduped from calories/Profile) → goal →
  days → focus → pulsing-logo "building" theater → staggered plan-reveal
  cards. Profile's Body-profile height also switches to ft/in when the
  unit is lb (heightCm stays canonical in storage). Direction-aware StepSlide transitions;
  every choice step confirms with an explicit Continue button (auto-advance
  shipped first, Adilzhan vetoed it. You can't change your mind); Skip
  everywhere, hardware Back walks steps (first-run not dismissable),
  answers prefill from Settings on rebuild. GOTCHA (hit again): flex:1 on
  a Squish inside a row collapses it to 0 width, the days-per-week squares
  rendered as an empty page; wrap the Squish in a flex:1 View. Root shows it when `!settings.onboarded` (existing installs see
  it once) or via Profile's new "Training plan" card → Rebuild plan
  (`onRebuildPlan` prop).
- 2026-07-10: Home rebuilt as a day dashboard (nutrition-app reference from
  Adilzhan). New pieces: `DateRuler.tsx`, horizontal snap FlatList of day
  numbers (ITEM_W 54, window 365 days back, ending at today so the future
  is unscrollable), scroll-driven native interpolations (scale 0.72→1.25;
  ink layer crossfaded over a faint layer since text color can't animate
  natively), 5 tick marks per cell + fixed ▲ caret; exports `dayStart`/
  `addDays` (calendar-based math, adding 24h blocks drifts an hour across
  DST, caught by a scratchpad spot-check). `CalendarDialog.tsx`, custom
  calendar in CenterDialog: ‹month› stepper, tap title → month grid +
  ‹year› stepper, Mo-Su grid, black capsule selected / ringed today /
  future disabled. `charts.tsx`, `SegmentedBar` (barcode bars, animated
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
- 2026-07-10: Floating top bar, the dock's light twin. The in-flow
  logo/greeting/avatar row in App.tsx became an absolute pill (top 8,
  left/right 14, height 52, `C.surface`, radius 999, clay shadow; logo
  left, greeting centered, avatar right) so tab content scrolls under it.
  `TOP_BAR_SPACE` (60) in theme.ts = screen top → below the bar; every tab
  ScrollView and in-tab overlay (WorkoutSummary, ExerciseInfo,
  ExerciseBrowser toolbar, which also covers ExercisePicker) pads
  `TOP_BAR_SPACE + <old padding>`. Render order in Root: content → top bar
  → BottomNav → Profile, so the bar (like the dock) stays visible over
  in-tab overlays but Profile covers both. CAREFUL: overlays with a FIXED
  header outside their ScrollView (ExerciseInfo, ExerciseBrowser toolbar)
  need the TOP_BAR_SPACE padding on the HEADER, not the scroll content,
  ExerciseInfo shipped with it on the wrong one (header hidden under the
  bar, content double-spaced) and was fixed after Adilzhan hit it.
- 2026-07-10: WorkoutSummary compacted + ⋯ menu. All exercises now render
  in ONE Card (sections split by Divider, 1RM column label on the first
  section only; the old card-per-exercise ate too much space,
  `highlightExerciseId` now tints the section lime instead of ringing a
  card). The duration/volume/kcal/PRs stats bar sits ABOVE the exercises
  card (was a floating footer pinned over the navbar, per Adilzhan). Header gained a ⋯ button opening a CenterDialog menu (the app's
  shared animated dialog): Repeat workout (starts a fresh session from the
  workout's entries, all sets unticked, jumps to the Workout tab; disabled
  while a session is live), Save as routine (`saveRoutine` with unticked
  sets), Share workout (RN `Share` sheet, name, long date, stats line,
  per-exercise "N × name, top kg" lines), Delete workout (ConfirmDialog →
  `deleteWorkout` → close). `startWorkout` now stores
  `routineId: routine?.id || undefined` so repeating a quick-start workout
  (ephemeral routine with id "") doesn't stamp an empty routineId. Icon
  gained Share2.
- 2026-07-10: Strong-style exercise header in the live session, the trash
  button is gone, replaced by a focus-metric pill + a ⋯ menu (both
  anchored popovers, same Modal+PopIn+statusBarTranslucent pattern as the
  set-type menu, right-aligned under their buttons). Metric pill: shows a
  Waypoints icon until a metric is picked in the "Set a Focus Metric"
  dialog (Total Volume / Volume Increase / Total Reps / Weight/Reps,
  live values from `metricsFor` in Workout.tsx: done sets only, increase
  is % vs the most recent finished workout with that exercise, clamped to
  +0% until something is logged, top set for Weight/Reps); the pick is
  saved as `WorkoutEntry.focusMetric` (types.ts) so it persists/syncs;
  re-picking clears it. ⋯ menu is UI-only for now (Add note / Add sticky
  note / Add warm-up sets / Update rest timers / Replace exercise /
  Create superset / Preferences: lucide FileText, Pin, Diff, Timer,
  Undo2, List, SlidersVertical) EXCEPT Remove exercise (X, red), which
  routes to the existing ConfirmDialog since the trash is gone. Verified
  on the emulator end to end.
- 2026-07-10: Fixed the order/sort menu positioning on the Exercises page ([ExerciseBrowser.tsx](file:///home/wopler/dev/torq/src/components/ExerciseBrowser.tsx)) by shifting its absolute `top` coordinate by `TOP_BAR_SPACE` (setting it to `TOP_BAR_SPACE + 42` instead of hardcoded `42`). This positions the dropdown menu correctly under the Order button toolbar icon and prevents it from overlapping with/rendering under the floating top bar.
- 2026-07-10: Customized weight progression steps in the suggestion engine ([suggest.ts](file:///home/wopler/dev/torq/src/lib/suggest.ts)) based on equipment type. Added a dynamic `getWeightStep` helper that returns micro-loading steps (1 kg / 2 lb) for dumbbells, cables, kettlebells, and bands, while maintaining default steps (2.5 kg / 5 lb) for barbell/machine compound exercises. Integrated in `startWorkout` ([store.tsx](file:///home/wopler/dev/torq/src/lib/store.tsx)).
- 2026-07-11: Live-session set rows compacted (Adilzhan, three passes,
  gap-shaving alone read as no change; the space was the divider strip):
  final values: exercise Card gap 0, NO set-block gap, idle RestDivider is
  a fixed 12px-high strip (text 10), set row paddingVertical 1; the
  SET/PREVIOUS/KG/REPS header row carries its own marginTop 12 (room under
  the exercise-name pill, per Adilzhan) + marginBottom 3. Consecutive done
  sets sit flush as one tinted block, and a done set shows NO rest divider
  at all unless its countdown is actively running, idle "2:00" timers
  live under unfinished sets only. Verified on the emulator.
- 2026-07-11: Live-session done-set polish (Adilzhan): the RestDivider
  between two DONE sets is hidden (rest already happened; it stays while
  its countdown still runs, and at the done→open boundary), and the
  done-row tint lightened rgba(160,210,20,0.42) → 0.16. The old wash
  read too heavy. Verified on the emulator.
- 2026-07-11: Live-session KG/REPS inputs select their content on every
  tap (`SetNumInput` in Workout.tsx now passes `selectTextOnFocus`
  unconditionally, not just for done-set re-edits), prefilled values
  (suggestions, replays, plan reps) get replaced by typing instead of
  appended to. Verified on the emulator (tap → full-value selection).
- 2026-07-11: Plan-aware streaks (Adilzhan's idea, mechanics agreed in
  chat). `src/lib/streak.ts`, pure function of (workouts, plan routines):
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
- 2026-07-11: Streak modal auto-pops once per trained day: Home effect,
  first visit after today's first FINISHED workout opens StreakDialog
  after 450ms; `Settings.streakCelebratedDay` (local-midnight ms, synced)
  marks the day so it never repeats. GOTCHA: don't clearTimeout in the
  effect cleanup, updateSettings changes a dep, re-runs the effect, and
  the cleanup would cancel the timer before it fired. The pill stays
  tappable for on-demand opens.
- 2026-07-11: CenterDialog gained an EXIT animation (Adilzhan: dialogs
  popped in but vanished instantly): one Animated.Value drives backdrop
  dim + card scale/fade both ways, backdrop tap plays a 150ms ease-in
  shrink/fade before calling onClose (guarded against double-close).
  Children that close the dialog themselves can use the new
  `useDialogClose()` context hook for the animated path, ConfirmDialog's
  Cancel/confirm buttons now do; menu rows that call their own setState
  still unmount instantly (adopt the hook when touching them). PopIn no
  longer used by Dialog.tsx.
- 2026-07-11: Streak dialog redesigned to a Duolingo-style celebration
  (Adilzhan's reference image): new `src/components/StreakDialog.tsx`,
  hand-authored Lottie flame (`assets/flame.json`, 2s loop: squash &
  stretch + rotation flicker anchored at the flame base, counter-phased
  amber mid + white core layers, two rising embers; played via
  lottie-react-native 7.x, bundled in Expo Go) inside a soft peach halo,
  giant count, "Day Streak", personalized encouragement (settings.name;
  at-risk variant in warnAcc), Monday-first week strip (orange
  LinearGradient check circles on trained days, plain day numbers
  otherwise, today bold), gold-trophy longest line. Home's old inline
  streak dialog replaced. NOTE: killing a Metro the app is attached to
  makes Expo Go show "Cannot connect to Expo CLI", force-stop + reopen
  the exp:// URL. Verified on the emulator (two captures confirm the
  loop is animating).
- 2026-07-11: WorkoutCard restructured (Adilzhan's spec): pills row gone,
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
  App.tsx (useFonts) and theme.ts FONT tokens changed: every component
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
  (1) WEEK STRIP, Monday-first 7 dots for the selected day's week:
  trained day = lime check, today = lime ring, planned weekday = faint
  ring with date number, rest = dot; eyebrow "This week · X of Y done"
  (Y = plan sessions, fallback 3). (2) RANK MOMENTUM: RankBadge +
  points + "▲ +N this week" (overall pts now vs before this Monday,
  rankLifts on workouts ended before weekStart) + tier label + pts-to-
  next + progress bar + "Closest tier-up: <lift>, N kg from <tier>"
  via new rank.ts helpers `kgForPoints` (inverse DOTS) and
  `closestTierUp`. Verified on the emulator (strip checks, +2 delta,
  bench 5.3 kg from Silver).
- 2026-08-06 (later): Ranks TAB + shield badges in RN (from the approved
  brand-v2 mockup). `src/components/RankBadge.tsx`: react-native-svg port
  of the lavish badge generator, rounded-hex shield (Polygon + thick
  round-join stroke), tier metal LinearGradient frame (World Class =
  holo multi-stop), vortex emblem (VORTEX_PATH now exported from
  Logo.tsx) scaled into the shield, orbit ring as sampled half-ellipse
  Paths with a userSpaceOnUse Mask cutting the gap around each static
  jewel ball (RadialGradient + specular dot; no SMIL/filters in RN so
  no comet trails/blur, since those stay web/share-card). Stage I-IV = ring →
  ball → two balls, derived from tier progress quarters (`stageOf` +
  `tierLabel` "Gold IV" in rank.ts). `src/screens/Ranks.tsx`: cardless,
  logo + "Ranks" + "NN kg · M/F" header, OVERALL row (badge + lime pts +
  tier label + pts-to-next + progress bar), LIFTS list (badge · name ·
  e1RM · tier label · pts). New "ranks" Tab (ui.tsx) second in the dock
  (Medal icon added to Icon.tsx). GOTCHA: module-level edits to
  BottomNav ITEMS didn't Fast-Refresh: force-stop Expo Go + reopen for
  a fresh bundle. Verified on the emulator with seeded data.
- 2026-08-06 (later): Rank engine v1 + Rank Card (PATH.md Phase 1 start,
  from the approved concept mockup). `src/lib/rank.ts`: pure functions,
  `dotsPoints` (official DOTS polynomial, sex+bodyweight normalized,
  bw clamped to the formula's valid range), 9-tier ladder on calibrated
  per-lift DOTS thresholds (Iron 30 → World Class 165; overall = ×3 on
  the sum of the TOP-3 lifts), `rankLifts` (best e1RM per exercise:
  finished workouts, no warmups, weight>0, reps 1-10; display-unit→kg
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
  prop; plain Pressable, not a morphing tab, the overlay covers the
  dock). Verified on the emulator: header at top, dock button opens
  Profile.
- 2026-08-06 (later): Splash/icon config modernized: legacy app.json
  `splash` key replaced by the `expo-splash-screen` config plugin (SDK 57
  deprecates the old key; package installed, without it Metro dies with
  PluginError). GOTCHAS: (1) Expo Go shows the app ICON (not the splash)
  while loading a project, and it CACHES project icons, after changing
  icon.png, `adb shell pm clear host.exp.exponent` is the only reliable
  flush, BUT pm clear also wipes AsyncStorage = the app's whole local DB
  on that device. (2) After pm clear, bare `am start -a VIEW -d exp://…`
  may not resolve to Expo Go, append the package: `am start -a
  android.intent.action.VIEW -d "exp://10.0.2.2:8081" host.exp.exponent`.
- 2026-08-06 (later): CARDLESS + DARK migration shipped (Adilzhan approved
  via the lavish mockups, "start migrating screens"). theme.ts rewritten:
  clay palette → near-black rebrand (page #0E0F0E, surface #151714 for
  interactive/overlays only, page2 #1B1E1A inputs, ink #F2F4EE→inkSoft
  #9AA294→inkFaint #5C6356 steps, NEW C.line #262A24 borders + C.hair
  #22261F hairlines, dark good/warn/bad/pr surfaces, light chart palette,
  black shadows); global.css mirrored. ui.tsx: `Card` is now a TRANSPARENT
  padded block (explicit background restores a bordered box), every old
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
- 2026-08-06: New brand logo, the lime "vortex" mark (8 sharp blades
  spinning around a center; AI concept by Adilzhan, source
  `assets/torq_logo_v2.png`), replacing both the old pulse mark AND the
  planned sharp-tau direction (Adilzhan dropped the tau; PATH.md updated).
  Traced with potrace to one vector path: `Logo.tsx` rewritten (path in a
  1024 box under `<G transform="translate(0,1024) scale(0.1,-0.1)">`,
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
  removed at Adilzhan's request, laurel only. tsc clean; badges not yet
  ported to RN.
- 2026-07-11: Implemented a month switcher on the Stats page ([Stats.tsx](file:///home/wopler/dev/torq/src/screens/Stats.tsx)). Users can click left/right arrows to switch months, with the right arrow disabled for the future (relative to the current real month). Overview cards (workouts, volume, sets, hours), weekly charts (custom Monday-start weeks that fall in the month), body weight trendline, and logged measurements list are all scoped/filtered to the selected month.


- 2026-08-08: Per-exercise rank page + world-record mentions (PATH.md Phase 1
  continued). New `src/data/records.ts`, bundled, versioned IPF Classic
  (raw) world-record table per sex and weight class for squat/bench/deadlift
  (`RECORDS_VERSION`, `RECORDS_VERIFIED = false`: the numbers are an
  APPROXIMATE snapshot and must be re-checked against the official IPF
  database before release). New `src/lib/records.ts`, `recordLiftOf(name,
  equipment)` maps a library exercise onto a competition lift with strict
  keyword exclusions (barbell only; variations like incline bench, front
  squat, RDL, JM press, Jefferson squat get NO record line rather than a
  misleading one, verified against the catalog: 13 of 1500 names match),
  `worldRecord(lift, sex, bwKg)` picks the weight class, `recordShare`.
  ExerciseInfo gained a "Rank" tab (tabs row is now a horizontal ScrollView
  since there are five): big RankBadge + tier label + DOTS points + progress
  bar + "N pts to <tier>, about N kg more on your best set" (via
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
  of hand-written radii: pills that were really CONTROLS became tokens,
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
  TWICE: lime on the track, dark inside an overflow-hidden copy of the
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
  (seven women's SQUAT classes, that source duplicates its bench table
  there) so the Rank tab simply omits the record line instead of showing a
  wrong one. The mention now names the holder and the check date.
- 2026-08-08 (later): CARDLESS migration finished on the remaining screens
  (PATH.md Phase 2, "screen by screen"). The bug driving it: `Card` is
  transparent since the rebrand but still pads 16, so every Card inside an
  already-padded ScrollView double-guttered its content, charts and rows
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
  TriangleAlert. NOT DONE: `supabase/schema.sql` has NOT been applied, all
  six mirror tables 404 on the REST API, so sync will fail until Adilzhan
  pastes it into the SQL editor. This machine cannot reach the DB directly
  (db.<ref>.supabase.co resolves IPv6-only, "Network is unreachable") and
  the pooler host needs the project's region.
- 2026-08-08 (later): Phase 3 kickoff, social foundation shipped (see the
  "Social" section above): supabase/social.sql, src/lib/social.ts,
  src/screens/Friends.tsx, the You/Friends switch in Ranks, and a
  fire-and-forget snapshot publish inside the store's finishWorkout. The
  private mirror schema (schema.sql) was applied by Adilzhan, all six
  tables now answer 200 on the REST API. social.sql still needs the same
  paste; it has NOT been executed, so the Friends view will error until it
  is. tsc + android export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Phase 3 continued, social.sql applied by Adilzhan
  (profiles/friendships/rank_snapshots + find_profile all answer on the REST
  API). Added the friends head-to-head compare and the rank share card; see
  the "Social" section above for both. Structural fix along the way: Friends
  had been rendering inside the Ranks ScrollView, which would have made its
  overlays position against scroll content, Ranks now branches, giving the
  Friends view its own scroll root. Deps added: react-native-view-shot 5.1.0
  + expo-sharing (via `npx expo install`, so SDK-matched). tsc + android
  export clean; NOT yet eyeballed on the emulator, the share capture in
  particular is the one thing I cannot verify without running it.
- 2026-08-08 (later): Percentiles shipped, the hybrid rank engine is now
  whole (see "Percentiles + plausibility" above). Also added: plausibility
  caps on published snapshots, `rank_events` retention (each device prunes
  its own rows older than 90 days on publish, no cron job needed), and the
  rank-up feed section in Friends. Spot-checked the percentile curve: a
  125 kg bench at 83 kg bodyweight lands at the 49th percentile of
  competitive raw benchers, world records clamp at 99%, and the curve is
  monotonic across 20-300 kg. tsc + android export clean; NOT yet eyeballed
  on the emulator.
- 2026-08-08 (later): Percentiles surfaced beyond the Rank tab, each
  ranked competition lift on the Ranks tab now carries its "Stronger than
  N%" / "Top N%" line, and the rank share card gets a lime percentile chip
  for the user's strongest one (the single most postable line on it).
  Also verified the bundled IPF record table against the OpenPowerlifting
  dump: all 41 curated values are at or below the best IPF-raw result ever
  recorded in their class, 0 impossible entries. Deriving the records FROM
  the dump was tried and rejected, see PATH.md for why, so nobody repeats
  it. tsc + android export clean; NOT yet eyeballed on the emulator.
- 2026-08-08 (later): Device-testing round on Adilzhan's phone. Four fixes.
  (1) The Android navigation bar was drawing over the app: only BottomNav
  compensated for the inset, so every OTHER bottom-anchored control (the
  rest-timer pad, the picker's "Add N exercises" footer, the new-exercise
  sheet) sat underneath it and couldn't be tapped. The root SafeAreaView
  now reserves `edges={["top","bottom"]}`, so nothing in the app can draw
  under the bar and every hardcoded paddingBottom stays correct; BottomNav
  dropped its own inset maths (it would have double-counted).
  (2) Accounts were unreachable in the EAS build. See the "Building (EAS)"
  section above for the .env/eas.json cause and the new loud banner.
  (3) Rank badges were far too small for the app's headline feature: the
  exercise Rank tab is now a centred 190px shield with the tier and points
  stacked under it (was a 92px thumbnail in a row), the Ranks tab overall
  shield is 170px centred, and per-lift rows, Home momentum, Friends rows
  and compare columns all scaled up.
  (4) Sounds shipped. See the "Sound" section above.
- 2026-08-08 (later): Keyboard handling, see the "Keyboard" rule above.
  `KeyboardAwareScrollView` + `useKeyboardHeight()` added and wired into
  every screen that holds an input: live session (KG/REPS + the rest
  editor), Auth (replacing its hand-rolled KeyboardAvoidingView), Profile,
  Stats, Friends, RoutineEditor, Onboarding's about-you step, and the
  new-exercise bottom sheet in ExerciseBrowser. tsc + android export clean;
  NOT yet eyeballed on a device.
- 2026-08-08 (later): Test suite added (see "Tests" above), 128 vitest
  assertions across ten lib modules, plus the MAX_DOTS fix it caught.
- 2026-08-08 (later): Friend SEARCH replaced exact-handle-only discovery
  (Adilzhan's request mid-session). `search_profiles` RPC + trigram indexes
  appended to supabase/social.sql (re-run the file), `searchProfiles()` in
  social.ts, and a debounced (300ms) results list in Friends with a per-row
  Add button; people already in your list or with a pending request are
  filtered out. The handle-claim field still forces handle characters, but
  the search field does NOT sanitise input, otherwise a display name with a
  space is untypeable.
- 2026-08-08 (later): The live-session exercise ⋯ menu is no longer a set of
  dead stubs. Implemented: **Add note** (WorkoutEntry.notes, this session
  only) and **Add sticky note** (Exercise.notes, comes back every session;
  that split is the whole reason both exist), both rendered under the
  exercise header and tappable to re-edit; **Add warm-up sets**, which
  prepends a 40/60/80% ramp of the heaviest WORKING set, rounded to the
  bar's step and de-duplicated so a light top set doesn't produce three
  identical warm-ups (no-op on bodyweight); **Update rest timers**, one rest
  applied to every set of the exercise; **Replace exercise**, reusing the
  picker and keeping the set scheme. REMOVED rather than faked: "Create
  superset" (needs real grouping) and "Preferences" (never specified), a
  menu item that does nothing is worse than no menu item. Store gained
  `updateExercise`.
- 2026-08-08 (later): Crash + data-loss hardening (see "Failure handling").
  Added ErrorBoundary (per-tab and app-wide) and fixed loadDB silently
  discarding a corrupt database, it now preserves the blob and warns.
- 2026-08-08 (later): Account deletion + data export shipped (see the Play
  requirement section above). supabase/social.sql gained
  `delete_my_account()`; db.ts gained `wipeLocal()`; store gained
  `exportLocal`/`wipeLocalData`.
- 2026-08-08 (later): Startup + search performance, measured before and
  after. (1) Catalog split (see "ExerciseDB catalog"): 289 ms → 86 ms of
  cold-start work. (2) Search: the browser rebuilt each row's haystack,
  array alloc + join + toLowerCase over 1500 rows, on EVERY keystroke.
  `haystack()` now precomputes it once when the list is built and
  `matchesText()` takes pre-tokenized input, so 8 keystrokes over the full
  catalog went 17.3 ms → 1.1 ms. (3) The list was ALREADY virtualized (a
  SectionList with tuned windowing), so nothing was needed there, worth
  recording so nobody "optimizes" it again.
- 2026-08-08 (later): Women's squat record gap, searched again for an
  authoritative per-class source and found none that meets the bar (one
  aggregator declares its numbers "approximate" with no holders or dates;
  the OpenPowerlifting route was already rejected). Rather than invent
  numbers, the Rank tab now states explicitly when torq has no verified
  record for that class, so the blank reads as our data gap instead of "this
  lift has no record". `weightClassOf()` added to records.ts for that
  message. Filling it properly is a manual task against the official IPF
  database.
- 2026-08-08 (later): The Arena shipped (PATH.md Phase 4). See the section
  above. Re-run supabase/social.sql: it gained profiles.arena/.verified and
  the two arena RPCs. Regional boards remain TODO (no country is collected).
- 2026-08-08 (later): Freemium groundwork shipped (see "Entitlements /
  paywall"): entitlements.ts, Paywall + LockedPanel, gates on
  Ranks/Friends/Arena/share cards, a dev Pro toggle, and 8 tests pinning the
  promises (logging and backup stay free, nothing is both free and paid,
  unlock() refuses honestly instead of pretending).
- 2026-08-08 (later): Push notifications wired end to end in code (see the
  section above), client token registration, push_tokens table, and the
  notify Edge Function for friend requests and friends' rank-ups. NOT LIVE
  until the FCM credentials, function deploy and two webhooks are done.
- 2026-08-09 (later): ICON PACK SWAPPED, lucide -> TABLER (Adilzhan picked
  it from the lavish review `.lavish/torq-icons.html`, which drew the dock
  in four packs using each one's REAL published geometry, fetched from the
  Iconify API rather than redrawn).
  Why Tabler: same 2 px outline idiom on the same 24-unit box, so the swap
  is one map and nothing else, but drawn on a squarer grid, lucide's
  rounded terminals sat oddly against SHARP-10 and a logo made of blades.
  ~6 200 glyphs vs lucide's ~1 600; MIT; official RN package.
  THE BIG SURPRISE, and the reusable lesson: the Android bundle went
  6.00 MB -> 4.23 MB. That 1.78 MB is NOT the pack. It is the IMPORT
  STYLE. The old `import { Archive, ... } from "lucide-react-native"` is a
  BARREL, and Metro does not tree-shake, so the app shipped all ~1 600
  lucide icons to use 57. Icon.tsx now deep-imports
  (`@tabler/icons-react-native/IconHome`), one module per icon. Do not
  "tidy" those 57 lines into one import.
  The MAP KEYS are still the old lucide names, on purpose: ~60 call sites
  say `<Icon name="Dumbbell" />` and renaming them across 20 files would be
  churn. Icon.tsx is the one place the two vocabularies meet.
  `src/types/tabler-icons.d.ts` exists because the package's `exports` map
  points subpath types at `dist/icons/*.d.ts` while they actually live at
  `dist/icons/icons/*.d.ts`, a packaging bug in 3.46.0. Delete the file if
  a later version fixes it.
  One glyph has no equivalent: lucide's BicepsFlexed became
  `IconStretching`. Everything else mapped on first choice, verified against
  the package's 6 243 exports rather than guessed.
  `lucide-react-native` is uninstalled; nothing imports it.
- 2026-08-09 (later): TAB SWITCHES MADE FAST, measured, not guessed.
  Adilzhan: "when i change pages it feels too slow". Instrumented first
  (stamp the moment setTab fires, log on the new screen's mount effect) and
  the numbers named the culprit immediately: Workout 38 ms, Stats 51,
  Home 114, Ranks 140-167, **History 601**.
  HISTORY was the whole complaint. Two causes, one real:
  (a) `computePRs` was called PER CARD and each call rescanned the entire
      history, quadratic. New `prTotals(workouts)` in stats.ts does one
      chronological pass; both it and computePRs now share a `scoreWorkout`
      helper so the fast path cannot drift from the slow one, and six tests
      assert they agree (including the same-`startedAt` tie case, which is
      why prTotals scores tied sessions as a group).
  (b) THE ACTUAL BOTTLENECK: the tab mounted every card at once, 37
      workouts × the six lucide icons a card draws. It is a SectionList now
      (initialNumToRender 5, windowSize 5, removeClippedSubviews).
      601 ms -> 80-118 ms.
  Also: Ranks memoised `rankLifts`/`overallRank`/`tierDates` (tierDates was
  called INLINE IN JSX, so it walked the whole history on every render), the
  carousel mounts only the badges within ±2 of the focused tier (each one is
  a 2 500-char traced path), and `RankBadge` is `memo`-wrapped. Home
  memoised its two `rankLifts` calls and `computeStreak`.
  AFTER: Workout 38, Stats 56, History 80-118, Home 86-90, Ranks 125-165.
  RANKS, a second pass: ablation, not guesswork. Baseline 113-115 ms;
  removing the eight lift-row badges took it to 81, removing the carousel to
  ~71. So the badges were ~75 ms of 113, and the emblem is the reason: a
  2 500-character traced path drawn thirteen times.
  Re-tracing the vortex was TRIED AND REJECTED, potrace at every tolerance
  came back 2 021-3 050 chars against the original 2 502 (RMSE 0.008, so
  visually identical but no cheaper). The original trace is already near
  optimal; do not spend another afternoon on it.
  What worked: nothing below the fold needs to exist in the first frame. A
  `warm` flag flips on a frame callback, and until it does the carousel
  mounts only the focused badge (`window={0}`) and the lift list only its
  first three. 113 -> 55-68 ms.
  Use `requestAnimationFrame`, NOT `InteractionManager`: the latter is
  deprecated in RN 0.86 and shows a runtime warning toast (which also sat
  over the dock and ate the taps in the middle of measuring this).
  Numbers are from the DEV bundle in Expo Go; a production build is faster.
  NOT DONE, deliberately: keeping visited tabs mounted. It would make
  revisits instant, but the RankBadge orbits and carousel loops would keep
  running off-screen, trading one performance problem for another.
- 2026-08-09 (later): ONE PAGE TITLE. Adilzhan: "there is a different size
  of page name on top in every page… remove the logo, make the page name
  consistent". The app had FIVE sizes for the same thing, 30 on Home, 26 on
  History/Workout/Ranks/Stats/Profile/Settings, 24 on sub-pages, 22 on the
  exercise browser, none of it chosen, all of it accumulated. `PageTitle`
  in ui.tsx is now the single definition (26 / extrabold / -0.6 tracking)
  and every page uses it; measured after, the five tab titles land within
  0.33 dp of each other. It carries `includeFontPadding: false` as part of
  the definition, which is also what keeps the streak pill level beside
  Home's heading.
  The Ranks header lost its `<Logo size={30} />`: no other page had one.
  Logo/SpinningLogo still belong on the auth gate, onboarding, the error
  screen, the paywall and the share card, and RankBadge still uses
  VORTEX_PATH.
  DELIBERATELY NOT migrated: the TodayHero panel headlines, the onboarding
  wizard's step titles, and Auth's centred "Confirm your email", those are
  hero copy inside a screen, not the page's name.
- 2026-08-09 (later): THE STREAK MARK IS OURS NOW. Adilzhan asked for a
  streak icon "unique to the app, not just an icon from a pack" and picked
  concept A, "Cut flame", from `.lavish/torq-streak.html`: a SOLID flame
  silhouette with two tapered BLADES cut out of it (evenodd), curving the
  way the vortex logo's blades curve. `src/components/StreakMark.tsx`.
  Method worth repeating: the candidates were generated PARAMETRICALLY
  (a tapered-blade function over quadratic beziers) and rasterised at 14 /
  16 / 20 / 28 px with rsvg before any of them were shown, because a streak
  mark lives in a pill next to a number and that is where icons die. That
  caught two failures, concept B's first draft read as a CROWN, and
  concept C's read as a blob below ~20 px. Regenerate with
  scratchpad `gen_streak.py` rather than nudging beziers by hand.
  OPTICAL FIX the same day: the mark's ink is 13.95 x 20.38 inside the
  24-unit box, so drawing it in a SQUARE left 3.15 units of dead air down
  each side, the streak pill's padding was geometrically equal (12/12) but
  looked lopsided because the real gaps were 15.2 px left against 12 px
  right. StreakMark now defaults to a TIGHT viewBox at the ink's true
  aspect (`STREAK_ASPECT`), so `size` is the flame's actual height and
  padding maths means what it says; `square` keeps the old box for the
  animated version, whose embers are positioned in those coordinates.
  Measured after, by sampling the screenshot per row (the pill is rounded,
  so a bounding box catches its own antialiasing): left 10.67 dp vs right
  11.00 dp, top 8.33 vs bottom 8.00, inside a third of a dp on both axes.
  `includeFontPadding: false` on the count removed Android's phantom line
  padding (which had the contents sitting 0.67 dp high); that shrank the
  pill 28 -> 26 dp, so `hitSlop={11}` restores a 48 dp tap target.
  SECOND ROUND, and the more useful lesson: the pill still "looked a bit
  up", and it was not the pill. It was the HEADING. `alignItems: "center"`
  centres a sibling on a Text's LINE BOX, and Android pads that box above
  the caps, so the pill sat 1.67 dp above "Sunday"'s cap block (and the
  descender of "y" pulls the ink centre lower still). Adding
  `includeFontPadding: false` to the heading landed it at +0.17 dp of the
  cap block. **When something next to text looks vertically off on Android,
  suspect the text's line box before you nudge the thing beside it.** Not
  applied globally in `Txt` on purpose. It would shift spacing on every
  screen at once, which is not a change to make blind.
  ONLY the streak uses it. Kcal keeps lucide's stroked `Flame` in
  WorkoutCard / WorkoutSummary / Settings, which turns a collision into a
  distinction: solid mark = your streak, outline = energy burnt.
  `StreakMarkLive` replaced the hand-authored Lottie in StreakDialog,
  keeping it would have meant the celebration using a DIFFERENT flame from
  the pill that opened it. It keeps what the Lottie had that mattered
  (squash-and-stretch flicker, two rising embers) on the native driver.
  `assets/flame.json` stays in the repo but nothing references it, and
  `lottie-react-native` now has no importer in src/.
- 2026-08-09 (later): HOME REBUILT as "Today, full-bleed" (Adilzhan picked
  idea 1 from the lavish review `.lavish/torq-home.html`; his brief was
  "remove volume completely, no one is measuring that… show more about
  stats, today's session (rest or training day) with more visuals so the
  user knows what day is today").
  The diagnosis the screenshots made obvious: a REST DAY and a TRAINING DAY
  rendered as the SAME typographic block with a different noun (eyebrow,
  headline, grey sentence), so you had to read the page to learn what today
  was. The day is now a panel that changes shape: training is lime-gradient
  and framed with muscle chips and a big Start; rest is a grey moonlit
  object with no primary CTA that spends its space on what is recovering
  and what lands next. Verified BOTH states on the device (the training
  panel by temporarily forcing the state, then reverting).
  DELETED: the volume Sparkline (it measured work done, not strength) and
  the DateRuler. It cost ~90 px to repeat the date already in the header
  and its ticks said nothing about which days you train. The week strip now
  carries that, tagged PUSH / PULL / LEG per day, and the calendar button
  still reaches any date.
  NEW `src/lib/muscles.ts` (11 tests): `routineMuscles` ranks a session's
  body parts by SET COUNT, volume would let one heavy squat outrank six
  shoulder movements, `recovering` gives days-since per group counting
  only ticked working sets (a warmup does not fatigue anything worth
  reporting), and `sessionTag` makes the week-strip labels.
- 2026-08-09 (later): HISTORY BACK IN THE DOCK. Adilzhan asked "where is
  history page?", which is the answer to whether a lime "See all" link on
  Home was a discoverable enough entry point. It is a tab again, so the dock
  is six fixed slots at ~58 dp. That is NOT a return to the old problem: the
  36 dp squeeze came from six tabs PLUS a separate profile button PLUS the
  capsule stealing 2.6× the width, and with the morph gone six equal slots
  still clear Android's 48 dp minimum. History dropped its back chevron and
  its back-to-Home handler (it is top level again); Home's "See all" stays
  as a second door. Exercises remains a sub-page of Workout.
- 2026-08-09 (later): RANK BADGE ANIMATED + THE TIER LADDER (Adilzhan: show
  the badge bigger, animate the orbit on every tier and not just World
  Class, and list the tiers with the points each needs, "like in games, so
  they are disabled, but user can see how they look like").
  `RankBadge` now has TWO render paths and the split matters: STATIC (the
  default) is the old single-SVG badge with the balls parked and the ring
  masked around them, list rows keep it, because Ranks draws 8 lift rows,
  Friends draws a row per friend and none of them should pay for motion
  nobody is watching. ANIMATED (`animated` prop) actually orbits. RN has no
  SMIL, so one looping Animated.Value drives translateX/translateY/scale/
  opacity through interpolation tables sampled off the tilted ellipse, all
  on the NATIVE driver, the motion never touches the JS thread while you
  scroll. Z-ORDER IS FAKED: each ball is drawn TWICE, once under the shield
  and once over it, cross-fading between the copies at the ellipse's left
  and right extremes where the ball is clear of the shield and the swap is
  invisible. The balls are plain Views, not SVG circles, at ~12 px a fill
  plus a specular dot is indistinguishable from the radial gradient and
  costs a fraction of the nodes. The animated path drops the ring's mask gap
  on purpose: an opaque ball riding over a continuous ring reads as "in
  front" by itself, and animating the mask would need JS-driven SVG props.
  The Ranks hero went 170 → 248 px with negative vertical margins, because
  the artwork only occupies y 25-104 of the 136-unit viewBox and at that
  size the empty bands are ~45 px at each end.
  NEW `src/components/TierCarousel.tsx`: all nine tiers as a horizontally
  scrollable ladder (a 3×3 grid shipped first and Adilzhan replaced it the
  same day). It IS the hero. It opens centred on your own tier at 240 px,
  and swiping walks the ladder. Earned tiers show the DATE they were reached
  and keep orbiting; locked ones carry a lock, the points required and how
  many to go, and stand still at 50% opacity, the real art, never a
  silhouette, because the point is seeing what Diamond looks like while you
  are still Silver.
  Mechanics follow DateRuler: one scrollX Animated.Value drives every item's
  scale and opacity on the NATIVE driver, so flicking through nine badges
  never touches the JS thread; only the caption needs JS, and its listener
  is guarded on the centred index actually changing. Slot geometry is solved
  rather than guessed. The centred badge renders 240 wide (edge 120 from
  centre) against a neighbour's inner edge at 133, so the cards never
  overlap into a stack. GOTCHA fixed: the carousel is full-bleed, so the
  side padding must NOT subtract the page gutter, or every centred badge
  sits 16 px left of centre.
  `tierDates` in progress.ts supplies the achieved dates: it walks the same
  running-best map and records the FIRST crossing of each threshold. First
  reached, not currently held, points fall when bodyweight rises, and a
  badge that un-earns itself is a promise broken; games don't take tiers
  back and neither does this.
  Orbit verified on the emulator by capturing three frames 1.4 s apart and
  montaging them, the ball visibly crosses in front of the shield.
- 2026-08-09 (later): STATS REBUILT as "the climb" (Adilzhan: "I don't like
  that it shows the volume, not rank advancement, or weight increasing in
  exercises". He picked idea 1 plus the dumbbell chart from idea 2 in the
  lavish review `.lavish/torq-stats.html`, which embeds real screenshots of
  the old page rather than a mock of it).
  The old page led with "29k VOLUME (KG)" and its biggest chart was weekly
  volume, above a near-identical weekly workout-count chart, four of whose
  six slots were empty. Volume measures how much work you did; it rewards
  long sessions, not strong ones.
  NEW `src/lib/progress.ts` (pure, 16 new tests): `rankHistory` replays DOTS
  points across a window, the running best-per-exercise map is advanced
  through the workouts ONCE rather than recomputed per sample, because the
  naive version is quadratic and this runs on every render, and reads
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
  RAMP was `rgba(26,27,26,…)`, near-BLACK, left over from the light clay
  theme, so on the #0E0F0E cardless page every segment was invisible and
  the bar rendered as an empty grey strip beside a legend of percentages;
  it is now a validated ordinal ramp for a dark surface (monotone lightness,
  ΔL ≥ 0.06 per step, 2.17:1 at the dim end). And dropping the empty weekly
  buckets turned a sparse chart into a ONE-BAR bar chart, so the weekly bars
  now need two weeks before they draw at all. One bar is not a chart, it is
  the figure already printed above it.
- 2026-08-09 (later): FIRST EMULATOR RUN since the push work, the app did
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
  near this page) and Edit profile; then three quick links, Friends,
  Training plan, Settings.
  NEW `src/screens/Settings.tsx` is the grouped hub. Its rule: EVERY ROW
  SHOWS ITS CURRENT VALUE, so "what unit am I on" is answered by scanning,
  not tapping. Single-switch controls (units, sound) stay inline; anything
  with more than one field opens a `SubPage` (body profile, daily goals,
  account, your data, developer), plain `sub` state plus a shared frame,
  not a router. Developer tools are now two taps off the main path instead
  of sitting under a real user's history.
  Also: the Ranks You/Friends/Arena segment moved from Ranks' local state
  into `useUi` (`ranksView` + `openRanks(view)`), so Profile's Friends row
  can deep-link straight to the Friends segment. `Icon` gained Camera and
  UserRound.
- 2026-08-09 (later): BOTTOM NAV redesigned, "Five, spelled out" (Adilzhan
  picked it from the lavish review `.lavish/torq-navbar.html`, which put the
  current morphing dock next to three interactive alternatives). The
  diagnosis was measured, not guessed: on a 360 dp screen the dock's 6 tabs
  plus the profile button shared 274 dp, and with the active tab at 2.6x the
  flex of the others an IDLE tab was ~36 dp, under Android's 48 dp minimum
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
- 2026-08-09 (later): HISTORY REBUILT as THE TIMELINE (Adilzhan: "I don't
  really like how history page looks like"; he picked idea A from the lavish
  review `.lavish/torq-history.html`, which embeds real screenshots of the
  page as it was). The old page was a wall of identical WorkoutCards: every
  session rendered the same five-line inventory of "4 x Barbell Full Squat
  ... 90 kg", so a session that set fifteen records looked exactly like three
  sets of bench. It was also the LAST screen still leading with VOLUME and
  calories, months after both were cut from Home and Stats.
  `src/screens/History.tsx` now draws a rail down the left with one node per
  session (LIME when the session set a record, hollow when it did not) and
  the row says what the session DID: "15 PRs" (gold), "+4 pts" (lime) and the
  muscles worked, over duration/sets/exercises. The exercise list is gone
  from the row; it was always one tap away in the summary, which is
  unchanged.
  The empty days are NAMED between the nodes ("1 day off"). That is the whole
  argument for the redesign: a log's second job is showing your pattern, and
  a gap marker says more about a training year than any per-session number.
  Gaps are computed WITHIN a month only, one spanning a month boundary would
  render above the next month's header and read as the wrong month's rest.
  Two implementation notes worth keeping:
  - Every row draws its OWN slice of the rail (plus a cap at the first and
    last node of a month) rather than the list drawing one long line. The
    list is virtualised, so a single continuous rail would be cut wherever
    windowing decided to unmount. Stacked segments are seamless and survive
    recycling.
  - The two new numbers are ONE chronological pass each, not one per row:
    `prTotals` (stats.ts, already there) and the new `pointsPerWorkout`
    (progress.ts), which replays the running best-e1RM map and diffs overall
    DOTS before and after each session. Per-row computation is what made this
    page cost 600 ms to open in the first place.
  Also new: `workoutMuscles` in muscles.ts (ticked, non-warmup sets only, a
  session where you racked the bar after two warmups did not train that
  muscle). `WorkoutCard` stays: Home's recents and the exercise-info History
  tab still use it. tsc + 180 tests + android export clean; verified on
  emulator-5556 (timeline, gap markers, rail caps, tap-through to summary).
- 2026-08-11 (later): AUTO-DELOAD, WRAPPED AND PLATE MATH, finishing
  FEATURES.md's top five.
  AUTO-DELOAD (`src/lib/deload.ts`, 12 tests). `suggest.ts` already asks "is
  THIS lift stuck?" per exercise; nobody was watching the pattern ACROSS
  lifts. One stalled lift is a normal week; most of them stalling at once is
  fatigue, and the answer is a lighter week rather than a per-exercise cut.
  A Home card offers it, `Settings.deloadUntil` runs it, and `startWorkout`
  eases every prefilled weight to 85% while it lasts, INCLUDING hand-typed
  routine weights, because the point is that this week is lighter.
  A TEST KILLED THE FIRST IMPLEMENTATION and the replacement is better for
  it: v1 asked `suggestWeight` whether a lift had earned a jump, on the
  theory that reusing the prefill engine would keep the card and the logger
  in agreement. But that engine needs the PRESCRIBED rep target, and the only
  target available here is the reps you actually did, so "did you hit target"
  was true by construction and nothing ever looked stalled. It is a WEIGHT
  TREND now (top working weight has not moved across three sessions), which
  needs no target and is also what a lifter means by stuck.
  Deliberately conservative: a majority of at least three tracked lifts, each
  with three sessions of history, all trained inside 14 days. A card that
  cries deload every week gets ignored forever.
  WRAPPED (`src/lib/wrapped.ts`, 9 tests) reduces a month to five numbers and
  a `ShareWrappedCard` face, entered from a card at the top of Progress. A
  lift's DEBUT is not counted as a jump from zero, which would have the card
  bragging "+158 kg" about a beginner's first squat. Hidden under two
  sessions: one session is a workout, not a month worth wrapping.
  PLATE MATH (`src/lib/plates.ts`, 12 tests) is the core of the gym-profiles
  idea: the bar and the plate set are the only two facts that differ between
  gyms, and they are all the maths needs. "Plate math" in the live-session
  exercise menu lists every distinct weight with its per-side loadout
  (152.5 kg → 25 · 25 · 15 · 1.25), marks warm-ups, and refuses to invent a
  loadout for weights a bar cannot make.
  GREEDY IS OPTIMAL HERE, which is not true of coin problems generally: real
  plate sets are each at least half the next one up, so taking the heaviest
  that fits can never strand a remainder. A test sweeps every loadable weight
  to 140 kg and asserts an exact hit.
  `nearestLoadable` rounds DOWN on purpose: rounding a suggestion up would
  quietly make the session harder than the engine intended.
  `Settings.barWeight`/`plates` exist and are honoured, but NOTHING WRITES
  THEM yet, so the dialog says what it is assuming rather than pointing at a
  Settings screen that does not exist. See FEATURES.md for what is left of
  the gym-profiles idea.
- 2026-08-11 (later): GHOST MODE + PER-SET TIMESTAMPS, the first two items off
  FEATURES.md's top five.
  `WorkoutSet.doneAt` now stamps `Date.now()` when a set is ticked (cleared
  when un-ticked, and it survives `finishWorkout`, which strips only
  `suggested`). NO UI reads it yet, on purpose: it is the richest signal a
  barbell app can collect about itself (real rest rather than planned, lived
  versus backfilled sessions, pacing that decays as sets get hard), and it
  feeds both honest rest analytics and the realism half of the trust ladder.
  Shipped first because HISTORY THAT WAS NEVER CAPTURED CAN NEVER BE SCORED:
  every month of delay is a month that can never be audited.
  GHOST MODE (`src/lib/ghost.ts`, 12 tests) races the last time you did this
  session, shown as one line under the live-session header: "660 kg ahead of
  Aug 3 · then Barbell Bench Press 70 × 8".
  THREE DECISIONS worth keeping:
  - "By this point" is defined by SET INDEX, not the clock. Comparing on
    elapsed time would punish you for chatting between sets, which is not the
    race. Only ticked sets count, and only the ghost's sets at those same
    positions, so the comparison is fair however far in you are.
  - WARM-UPS HOLD NO POSITION on either side. A ghost that ramped in two
    steps against today's four would misalign every comparison after it.
  - The comparator is work (weight × reps). That is NOT a contradiction of
    volume being cut from Home, Stats and History: there it was a bad measure
    of PROGRESS, here it is a running score inside one session, and it is the
    only quantity that accumulates set by set.
  `findGhost` prefers the most recent session with the same `routineId`, then
  falls back to the one sharing the most exercises (quick-start sessions
  carry no routine id but are often the same workout), and refuses anything
  sharing less than half, since one shared exercise out of eight is not the
  same session.
  The line only appears once something is ticked: "level with Aug 3" on an
  empty session is noise, not a race.
- 2026-08-11 (later): DELETING A SET IS NOW A FULL SWIPE (Adilzhan: "it
  should let me drag it fully to the left, and the whole line is red. When
  it's all red then show a confirmation dialog").
  The old version revealed an 88 px Delete button that you then had to hit,
  which is Strong's pattern and two gestures for one decision. Now the swipe
  IS the decision: a red bed grows behind the row, brightens to full red past
  a commit point at 55% of the row width, and releasing there slides the line
  fully red and asks. Releasing short of it springs back.
  The commit point buzzes (`Vibration.vibrate(12)`) the moment it is crossed,
  the way the OS does, so the point of no return is felt rather than watched.
  THE CONFIRM LIVES WITH THE PARENT. SwipeToDelete only reports that a full
  swipe happened and takes `open` back as a prop, so cancelling the dialog is
  what returns the row. A dialog owned inside the gesture component would put
  the same modal in every row of the list.
  The dialog names the set ("90 kg × 8"), and when it is the LAST set it says
  the exercise goes with it, which replaced the old chain of two dialogs.
  Verified on the emulator by recording the drag at 15 fps: the bed appears,
  the label fades in, the red brightens at the commit, and the confirmation
  opens on release. Cancel returns the row.
- 2026-08-09 (later): SWIPE LEFT TO DELETE A SET (Adilzhan asked how users
  delete sets, referencing Strong). There was no way at all: the live session
  had "Add set" and no inverse, so a mis-tapped extra set stayed for the rest
  of the session. Now every set row swipes left to reveal a red Delete.
  `src/components/SwipeToDelete.tsx` is HAND-ROLLED on PanResponder +
  Animated rather than react-native-gesture-handler's Swipeable. The
  dependency is not in this project, its legacy Swipeable is deprecated in
  favour of a Reanimated one, and Reanimated needs a babel plugin, and this
  app has NO babel.config.js at all, because NativeWind v5 is CSS-first.
  Trading a 60-line gesture for a build-config change is a bad deal.
  THE ONE THING THAT MATTERS IF YOU TOUCH IT: the claim is
  `onMoveShouldSetPanResponderCapture`, not the bubbling version. The row is
  full of Pressables and TextInputs, and once a child holds the responder an
  ancestor can only take it during the CAPTURE phase. The bubbling handler
  shipped first and did nothing at all. The 12 px + |dx| > 1.6·|dy|
  threshold is what keeps taps, field focus and vertical scrolling with the
  child; all three were re-verified on the emulator after the change.
  Opening is CONTROLLED by ActiveSession (`swipeOpen` holds one "ei-si") so
  only one row can sit open. Two half-open rows read as a rendering bug,
  and an open row's own content is covered by a close-on-tap overlay, since
  its controls are shifted off their labels while it is open.
  `removeSet` takes NO confirmation on purpose: one set is cheap to retype
  and a dialog on every mis-swipe costs more than the mistake. Deleting the
  LAST remaining set falls through to the exercise's existing confirm instead
  of leaving an empty header. It also cancels a running rest and clears the
  grow-in keys for that exercise, because both are keyed by set INDEX and
  every index at or after the removed row now points at a different set.
  GOTCHA that ate twenty minutes: pressing hardware Back at the app root
  exits Expo Go, and the `am start` that follows serves the CACHED bundle,
  so edits appear not to apply. Force-stop first. Proven by giving the
  component a red border and screenshotting for it, which is the fastest way
  to answer "is my code even live".
- 2026-08-09 (later): NOTES REDRAWN like Strong's (Adilzhan: "here is how
  sticky note and note looks like. it's too bad", with a Strong screenshot).
  Both notes were 12 px grey lines wedged under the exercise name, the
  sticky one in inkFaint, which is the app's DIMMEST ink. A note you wrote to
  your future self is an instruction ("elbows in", "bar on pin 4"); rendering
  it fainter than the column headers guarantees it gets skipped.
  Now, in Strong's order: exercise name → STICKY NOTE as a full-bleed amber
  band (C.warnSurf, pin + warnAcc text, margin −16 so it reaches both screen
  edges) → SET/PREVIOUS/KG/REPS header → SESSION NOTE as a field-shaped box
  (page2 fill, hairline border, R.sm) → the sets.
  The split in PLACEMENT now carries the split in MEANING that already
  existed in the data: the sticky note belongs to the exercise and comes back
  every session, so it sits with the exercise's identity; the session note is
  about today ("shoulder felt off"), so it sits inside today's list. Editing
  is unchanged, tap either to open the existing dialog.
- 2026-08-11 (later): A DONE SET LOSES ITS INPUT BOXES (Adilzhan: "when set
  is done show KG and REPS inputs without background, just numbers, but still
  clickable and changable"). `SetNumInput` already collapsed a finished set
  to a Pressable, but kept the page2 fill and the hairline border, so it
  still looked like a field. A field is an invitation to type and a finished
  set is a record, so the number now stands on the lime row on its own.
  The metrics still match `NumberField(compact)` TO THE PIXEL, border width
  included (the border is transparent rather than absent), because the box
  comes back the instant you tap to edit and the row must not jump when it
  does. Verified on the emulator: tapping a done value restores the field
  with the number selected, and the row lines up with the unfinished row
  below it.
- 2026-08-11: THE STREAK IS A CHARACTER NOW (Adilzhan installed a Lottie and
  asked whether its colour could be changed, then: "save that creature as png
  or svg and show it instead of this pill with black icon and black 37").
  See the "streak creature" section above for the pipeline.
  Its palette turned out to be two colours: #CCFF00 on four fills and
  #000000 on two, and the black pair are the EYES. The flame is now the exact
  brand lime via `scripts/recolor-lottie.py`.
  THE PILL IS GONE from Home's heading. A filled lime capsule forces its
  contents dark, which is why the character lost its colour and the count
  read as black text in a blob. Bare on the page, the creature keeps the lime
  it was drawn in and the number is plain white, which is also what the
  cardless rule wants: surfaces are for interactive things, and this is a
  tappable label. State moved onto the CREATURE (lime safe, amber at risk,
  faint when dead) rather than a background, and the count only dims when the
  streak is actually dead, because a live number should never look disabled.
  Measured after: the creature sits 0.00 dp off the heading's optical centre
  and 0.17 dp off the number's, with the existing translateY correction doing
  its job unchanged.
- 2026-08-10 (later): EVERY EM DASH IS GONE, all 1,144 of them, across every
  tracked file (Adilzhan: "rewrite the CLAUDE.md and everything inside an app
  so it doesn't use em dashes"). Nothing carries one now except the two
  lines that have to name the character.
  NOT a character swap. A scratchpad script classified each occurrence and
  picked the punctuation that actually belongs: a dash PAIR became
  parentheses (including pairs that wrap across two lines), a label followed
  by its explanation became a colon, an independent clause became a full stop
  with the next word capitalised, and everything else became a comma. It
  never reflows, so lists, indentation and code stay exactly as they were.
  THREE BUGS IT CAUGHT ON ITSELF, worth knowing if this is ever repeated:
  (1) pairing dashes across lines joined two SEPARATE string literals and
  produced `"...already has an account (try signing in."` with an unbalanced
  paren, so cross-line pairing is now refused unless every line between is
  prose; (2) the subject test required a capital letter, but the word after a
  dash is nearly always lowercase, so almost every clause was misread as an
  appositive and got a comma; (3) the sweep rewrote the UI's "no value"
  GLYPH, the standalone `"—"` in the PREVIOUS column, the week strip and the
  dumbbell chart, turning it into a comma on screen. Those eight are now a
  plain `"-"`, which is a visual change and is verified on the emulator.
  Afterwards, 18 comma splices and 13 run-on lists were fixed by hand, found
  by grepping the diff for `, it is` / `, this is` patterns and by replaying
  which dash pairs the script had split. tsc + 198 tests + android export
  clean.
- 2026-08-10 (later): THE SCREENSHOT PIPELINE IS NOW REPEATABLE (Adilzhan:
  "we will add new features, so these screenshots should be updated, and you
  need to remember how you did that"). The one-off scratchpad commands became
  `scripts/snap.sh`, `scripts/build-shots.py` and `docs/shots/HOW.md`, and the
  rule lives in the "Screenshots + the README product page" section above.
  Verified by regenerating from the committed screenshots: `magick compare
  -metric AE` reports 0 differing pixels against both hero.png and a framed
  shot, so the scripts reproduce the artwork exactly rather than approximately.
- 2026-08-10 (later): README REBUILT AS A PRODUCT PAGE (Adilzhan: "make great
  screenshots of my app, cut the bar where time is shown, upload it on README
  but in the way like you are selling it, not just 3 screenshots").
  11 screenshots captured off emulator-5554 into `docs/shots/`, each cropped
  `1080x2232+0+120`, that strips the Android status bar (40 dp) and the
  gesture pill (16 dp) while keeping the dock, which is part of the app.
  `docs/shots/framed/` holds the same shots rounded, bezelled and shadowed by
  a scratchpad `frame.sh` (ImageMagick), so a raw screenshot reads as a
  device. `docs/shots/hero.png` is a 2600x1400 banner: wordmark set in the
  real Space Grotesk TTF from node_modules, the vortex dimmed to 6% bleeding
  off the bottom-left (the same watermark idea as the app's hero panel), and
  three phones with Home in front.
  GOTCHA in frame.sh: a mask drawn on `xc:none` with no `-fill` uses IM's
  DEFAULT fill, which is BLACK, as a CopyOpacity source that makes the whole
  image transparent and you get a bezel with nothing in it. `-fill white`.
  The old `docs/screens/` shots were deleted; they showed the clay/bento
  design from before the rebrand.
  FACTS CHECKED AGAINST THE CODE rather than written from memory, and two
  were wrong on the first pass: the tier ladder is Rust → Iron → Bronze →
  Silver → Gold → Platinum → Diamond → Elite → World Class (there is no
  "Master"), and the percentile sample is 2.2M LIFTERS, not results. The
  README also repeats the rule from the percentiles section: it never says
  "top N% of people", always "of competitive lifters".
- 2026-08-10 (later): HOME'S RECENTS ARE THE TIMELINE ROW (Adilzhan: "recent
  workouts on the home page have an old design, change it to what is shown
  now in History page"). History's node was extracted into
  `src/components/WorkoutRow.tsx` and both screens now render the SAME
  component (rail, PR dot, "15 PRs" / "+4 pts" / muscle chips) rather than
  Home keeping the old WorkoutCard with its exercise inventory, volume and
  calories.
  Two props keep the two contexts honest rather than forking the design:
  Home passes no `onDelete` (a glance list should not offer to destroy
  anything; History keeps its trash) and no `gapDays` (rest-day markers are
  History's way of showing your PATTERN: on three teaser rows they are
  noise).
  GOTCHA worth remembering: Home's ScrollView sets `gap: 14` on its children,
  which cut the rail between every row. The rows are wrapped in one View so
  the gap applies to the section, not between nodes.
  `WorkoutCard` survives, the exercise-info History tab still uses it, and
  there the per-exercise inventory is the point.
- 2026-08-10 (later): THE STREAK PILL, LEVEL FOR REAL (Adilzhan: "doesn't
  look equal isn't it? place them on the same line"). Measured before
  touching anything, and the pill was geometrically PERFECT: centred on
  "Monday"'s cap block to within 0.17 dp, its flame and digits within 0.33 dp
  of each other, padding 10.7 left / 11.0 right, 8.3 top / 8.0 bottom.
  It still looked high, and the reason is that `alignItems: "center"` centres
  on the text's BOX (cap top to descender bottom) while the eye centres on
  the word's INK. "Monday" hangs a "y" 13 px below the baseline, which pulls
  its visual mass 2.33 dp below the box centre. Every weekday name ends in
  "day", so that correction is the same all seven days and can be a constant.
  Fixed with `translateY: 2.3` on the pill; after, the gaps above and below
  the word's ink are 9 px and 8 px and the pill is 0.17 dp off its optical
  centre.
  A TRANSFORM, not a margin, and this is the trap worth remembering:
  `alignItems: "center"` centres the MARGIN box, so `marginTop: 2.5` moved
  the pill only 1.25 dp, half of what the number says. Measured, corrected,
  re-measured.
  BASELINE ALIGNMENT WAS CONSIDERED AND REJECTED: putting the digits on the
  word's baseline needs +4 dp, which leaves the pill's box hanging 13 px
  below the descender. Optical centring gives symmetry; baseline alignment
  gives a bottom-heavy badge.
- 2026-08-10 (later): THE VORTEX AS A WATERMARK on Home's hero (Adilzhan saw
  a dimmed shape behind the training-day card and asked for it to be our
  logo, what he was actually seeing was the lime gradient falling off, so
  there was nothing there yet).
  `HeroMark` in Home.tsx draws VORTEX_PATH from Logo.tsx at 340 px with 44%
  of it hanging off the right edge, at 8% opacity, clipped by the panel's own
  radius (`overflow: "hidden"` on the LinearGradient) and `pointerEvents:
  "none"`.
  THE SIZE IS THE WHOLE TRICK, and the first attempt got it wrong: a 260 px
  mark fits INSIDE the panel, so you see a complete vortex and it reads as a
  second logo arguing with the headline. Bigger and cropped, you see blades
  cutting in from the corner, which reads as texture. If you ever retune it,
  make it larger and push it further out, never smaller.
  Only on the LIT faces (training day, done today). The rest-day panel spends
  its space saying what is recovering and how long since, and a brand mark
  behind that is decoration competing with the one thing the panel is for.
  Verified both faces on emulator-5554 (the done face by temporarily forcing
  its branch, then reverting).
- 2026-08-10: EVERY MODAL REBUILT ON ONE SHELL (Adilzhan: "now it opens good,
  but slowly, and it takes time for me to be able to actually press on
  buttons there"). See the "Modals" section above for the rule; this is what
  was measured and why.
  THE ANIMATION, simulated and then measured on the emulator. Every overlay
  sprang in with `friction: 6, tension: 140`. Those are ORIGAMI units. RN
  maps them to stiffness 592 / damping 19 before solving, which the first
  pass at this got wrong, so the real damping ratio is 0.39: a 26% overshoot
  (the card sprang past full size and bounced back) and 967 ms before RN's
  rest thresholds stop it. Frame-differencing a screen recording showed
  150 ms of VISIBLE movement, the rest being sub-pixel ring. Replaced with a
  150 ms `Easing.out(cubic)` timing, measured at 117 ms of visible movement,
  no overshoot. The card also starts at 0.96 instead of 0.85: travel is what
  makes a target hard to hit, and 0.85 displaced a control near the dialog's
  edge by ~48 px mid-open, against ~6 px now.
  THE BIGGER HALF WAS NEVER THE ANIMATION, and this is the part worth
  keeping. Stamping the opening tap and logging the overlay's mount gave:
  a modal opened from HOME renders 30 ms after the tap and starts animating
  at 57 ms; the same code opened from the LIVE SESSION renders at 124 ms and
  starts animating at 218 ms. So the dominant cost is React re-rendering the
  whole ActiveSession tree (~124 ms) because the menu's state lives inside
  it, plus ~47 ms for react-native's Modal to inflate an Android window
  (measured as the render→effect gap: 47 ms inline vs 94 ms through a Modal
  on the same screen). NOT FIXED, deliberately, memoising ActiveSession's
  exercise blocks is a real refactor of a 1800-line file and belongs in its
  own change. The live session also re-renders the open popover every second
  via the elapsed-time ticker.
  WHY AnchoredModal KEEPS THE RN MODAL despite those 47 ms: an inline
  popover would sit under the dock (which the centered dialogs already do,
  but they are centered) and would need page coordinates translated into the
  screen root's space, which is exactly the status-bar bug this project has
  already fixed once. Paying 47 ms to keep four popovers correct is the right
  trade; the note is here so nobody "optimises" it blind.
  PROOF OF PRESSABILITY, since that was the complaint: firing the opening tap
  and a tap on the dialog's Cancel 100 ms apart from one adb shell dismisses
  the dialog: a control is live while the entrance is still running. At
  14 ms apart the second tap lands on the screen underneath, which is just
  the mount cost above, not the animation.
  ALSO IN THIS CHANGE: `Dialog.tsx` deleted and 15 files migrated
  (`CenterDialog`→`CustomModal`, `ConfirmDialog`→`ConfirmModal`,
  `useDialogClose`→`useModalClose`); the three live-session popovers and the
  exercise-browser order menu moved onto `AnchoredModal`; `PopIn` and
  `SlideUp` retuned off the same MOTION tokens (they were the same spring,
  SlideUp rang for 567 ms); hardware BACK now closes the top-most modal
  instead of falling through to the screen; the scrim color became
  `C.scrim`/`C.scrimDeep` after the new test caught two files painting their
  own; and the order menu now anchors off its button's page Y like every
  other popover, because AnchoredModal positions in window coordinates and
  its old hardcoded `TOP_BAR_SPACE + 42` was a local one.
  tsc + 198 tests + android export clean; verified on emulator-5554 (streak
  dialog, filter dialog, confirm dialog, set-type / exercise-⋯ / order
  popovers, the new-exercise sheet's backdrop, and Back-to-close).
- 2026-08-09 (later): WARM-UP SETS ARE NOW A DIALOG, Strong's (Adilzhan sent
  the screenshot and asked "idk if you count it the way Strong counts warm up
  sets. maybe there are different warm up set percentages for different
  exercises?").
  The old behaviour inserted a 40/60/80% ramp SILENTLY the moment you tapped
  the menu item, the wrong shape for the decision twice over: warming up for
  a heavy triple and warming up for lateral raises are not the same ramp, and
  a menu item that rewrites your set list with no preview is a thing you undo
  rather than a thing you use.
  `src/components/WarmupDialog.tsx` + `src/lib/warmup.ts` (10 tests): work-set
  field at the top, one row per warm-up with an editable formula and the REAL
  kilos beside it, Add set, Restore, Cancel, Insert. Defaults are Strong's,
  Bar × 5, 50% × 3, 80% × 3: not the old 40/60/80: three loaded ascending
  sets is a lot of work before the work, and Strong's ramp spends its first
  set on the movement itself.
  THE BAR IS A ROW TYPE, not a percentage, and that is the point: 50% of a
  40 kg work set is 20 kg, which IS the bar, but 50% of 120 kg is 60 and the
  bar is still 20. A ramp that cannot say "just the bar" has to fake it.
  BAR_WEIGHT is 20 kg / 45 lb.
  ANSWER TO THE QUESTION ASKED: there is no per-exercise default, because no
  honest one exists, nothing in the catalog says whether an exercise is a
  heavy barbell triple or a lateral raise. Instead the ramp is REMEMBERED on
  the Exercise (`Exercise.warmup`, so it syncs), and one tuned for squats
  stays with squats. The app learns yours rather than guessing.
  Percentages round to the loadable step for the equipment via the existing
  `getWeightStep` (2.5 kg barbell, 1 kg dumbbell), which is how Strong's
  screenshot gets 92.5 from 80% of 115. Rows that land at or above the work
  set are dropped: they are not a warm-up any more. Insert REPLACES existing
  warm-ups rather than stacking, so the preview is always what you end up
  with however many times you open it.
  GOTCHA, hit and fixed the same hour: `useDialogClose()` reads a context
  CenterDialog provides, so calling it in the component that RENDERS the
  dialog is outside the provider and silently returns the no-op fallback,
  Insert inserted and the dialog stayed open. The footer is its own child
  component now, the same reason ConfirmButtons is one in Dialog.tsx.
- 2026-08-09: Four requested changes (Adilzhan).
  (1) PROFILE PICTURES, `src/lib/avatar.ts` + `src/components/Avatar.tsx`.
  expo-image-picker (config plugin added to app.json). The picture is kept
  on the PHONE first (copied out of the picker cache into the document dir,
  `Settings.avatarUri`) and uploaded second (`Settings.avatarUrl` +
  `profiles.avatar_url`), so a guest gets an avatar too and a failed upload
  never costs the user their choice; display order is avatarUrl → avatarUri
  → lime initial, with `onError` falling back so a stale URI renders as the
  initial rather than an empty hole. Filenames and the public URL carry a
  timestamp because expo-image caches by URI, reusing one path would keep
  showing the old picture. Storage bucket `avatars` is public with
  folder-scoped writes (`<user_id>/avatar.jpg`), so nobody can overwrite
  someone else's face. Friend rows show the avatar next to the shield.
  (2) PROFILE RANKS ARE BADGES, not "GOLD"/"SILVER" chips: TierPill is gone
  from Profile, the overall rank is a 168px shield with the tier named
  underneath, and each best-lift row carries its own 52px shield. Identity
  (avatar + name + body line) moved OUT of RankCard into its own row above
  it, so a user with no ranked lift yet still has a face and a name.
  (3) HISTORY SEPARATION, the real cause was WorkoutCard ruling off its own
  sections with the SAME hairline the caller uses BETWEEN cards, so a list
  read as one continuous striped block. The card's two internal Dividers are
  gone (grouping is spacing + type weight now), its title went 15/bold →
  16/extrabold, and the only rule left on the page is the one that ends a
  workout.
  (4) USERNAME ON REGISTER, the Create-account tab asks for a handle with a
  debounced live availability check. `handle_taken` is now granted to `anon`
  as well (rewritten so its "not me" clause doesn't drop every row when
  auth.uid() is null) because there is no session yet on that screen. Since
  sign-up returns NO session (email confirmation is on), the name is parked
  in AsyncStorage by `rememberSignupHandle()` and claimed by
  `claimPendingHandle()` from an effect in AuthProvider on the first session
  that appears, which may be minutes later, after the confirmation link. It
  publishes (`visible: true`): asking for a username and saying "this is how
  friends find you" IS the opt-in. RE-RUN supabase/social.sql for the avatar
  column, the storage bucket/policies and the new grant.
- 2026-08-08 (later): Play launch pack written (docs/launch/), privacy
  policy, a data-safety answer sheet verified against the schema, store
  listing copy, and the ordered launch playbook. Key scheduling finding:
  the 12-tester/14-day closed test and pre-registration both have hard
  waiting periods, so they gate the date more than the code does.
- 2026-08-16: EXERCISE DEMO GIFS REMOVED (Adilzhan: "can we remove gifs for
  now? just show the description, and instructions on how to do this
  exercise?"). See the DEMO MEDIA IS OFF note in the ExerciseDB section for
  the two reasons and the seam.
  The measurement that started it: the files are 180x180 / 12 frames / 67 KB,
  and `ExerciseInfo.tsx` drew them at `width: "100%", aspectRatio: 1`, which
  is 328 dp, which is 984 physical pixels on a 3x phone. A 5.5x upscale, 30
  times more pixels than the file contains.
  THE ABOUT TAB NOW LEADS WITH THE TEXT, and it is better for it. The steps
  were a stack of 13px `inkFaint` lines under a big white square; they are
  now the page: a "Muscles worked" block, then "How to do it" as a numbered
  list with a lime number column and 14.5px/21 body. The catalog stores each
  step prefixed `Step:1 `, which is a storage artifact that was previously
  rewritten inline on every render; it is stripped once in a memo now.
  THE BROWSER ROWS LOST THEIR THUMBNAIL ENTIRELY rather than falling back to
  the existing dumbbell tile. That tile is right for ONE custom exercise in a
  list of photos and wrong when it is every row: 1500 identical grey squares
  carry no information and push the name in by 56 px. Row padding went 7 to
  10 to compensate, since the 44 px thumbnail had been setting the row height
  and without it two text lines are ~33 px, under Android's 48 dp minimum.
  ALSO SWEPT: 18 EN dashes across 12 files, missed by the 2026-08-10 em dash
  sweep because it only looked for the em. All of them were ranges ("11-25
  times", "3-20 characters", "reps 1-10"), so a plain hyphen is correct in
  every case; two were user-visible (the handle rules on Auth and Friends).
  A grep for either character across `src/` now returns 0.
  tsc + 243 tests + android export clean. NOT yet eyeballed on the emulator.
- 2026-08-17: Pre-submission compliance audit, four parallel passes over data
  safety, licensing, Play policy and listing truthfulness. Findings and the
  fixes applied the same day:
  - **Bodyweight and sex were reaching friends' devices.** `rank_snapshots`
    stores both (the rank engine needs them), RLS lets an accepted friend
    read the row, and `snapshotsByIds` selected them. No screen displayed
    them, which is exactly why it went unnoticed for nine days. Fixed on
    both sides: the client now lists columns explicitly, and `social.sql`
    revokes SELECT on those two columns and re-grants the other six at the
    COLUMN level. RLS is row-level and cannot express this on its own.
    `DATA_SAFETY.md` had claimed they were "never shown to other users",
    true of the UI and false of the wire.
  - **The build shipped CAMERA and RECORD_AUDIO.** `expo-image-picker` adds
    both unless explicitly disabled, and `app.json` set only
    `photosPermission`. Neither is used: `launchCameraAsync` appears
    nowhere. `PRIVACY.md` said "No microphone or camera access".
    RECORD_AUDIO on a workout tracker would have drawn a sensitive
    permission review on its own.
  - **Photos were declared as NOT collected while the avatar picker
    uploads one.** Both launch docs corrected; Photos added as a declared
    type.
  - **A deleted account left its avatar behind in a public bucket.**
    Storage has no FK to `auth.users`, so nothing cascaded.
    `delete_my_account()` now deletes the object explicitly. The public
    read policy also had no role restriction, so anyone holding the
    publishable key (which ships in every APK by design) could enumerate
    the bucket; scoped to `authenticated`. The bucket is still
    `public = true`, so a known path is still served without RLS. Closing
    that needs signed URLs, and is parked behind the keep-or-cut decision
    on avatars.
  - **"2.2 million competition results"** appeared in four places including
    the in-app paywall pitch, and exists nowhere in the data. Real per-lift
    n is 133,697 to 401,158, summing to 1.46M lifter-lift bests.
  - **Two screens broke the percentile rule.** Ranks and Profile rendered a
    bare "Top 8%" with no population named, while the README claimed the
    app says "of competitive lifters" every single time. Fixed by putting
    the qualifier in `percentileLabelQualified()` rather than in each call
    site's JSX, so the next screen cannot get it wrong.
  - **The store listing promised "1500+ exercises with demonstrations"** and
    `PRIVACY.md` declared a network call to `raw.githubusercontent.com`,
    both left over from before demo media was switched off on 08-16. A
    listing promising removed media next to a policy naming a host the app
    never contacts is the combination that draws a policy action.
  - **The root `LICENSE` was `create-expo-app` boilerplate** asserting
    "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)" under MIT,
    in a public repo. That granted the world permission to use and sell
    torq. Replaced with a proprietary notice.
  - **No open source licences screen existed.** Space Grotesk ships as font
    binaries under OFL-1.1, which requires its notice to travel with them.
    Added `src/components/Licences.tsx` behind Settings → About, carrying
    OFL-1.1, Tabler MIT, lottie-react-native Apache-2.0, the RN/Expo
    notices and an OpenPowerlifting credit (public domain, so optional, but
    the percentiles are the app's strongest claim and naming the source is
    what makes them checkable).
  - Also: targetSdk was inheriting 35 from an Expo default with nothing
    pinning it, and API 36 becomes mandatory for new apps on 2026-08-31, so
    `expo-build-properties` now pins 36. The Developer card (Pro toggle,
    demo seeding) was shipping to production and is now behind `__DEV__`.
    Two unused third-party reference Lotties were removed from `assets/`,
    the directory Expo bundles from, and gitignored in `.lavish/`. The
    content-rating guidance said "Everyone" for an app with unmoderated
    user interaction and image uploads; corrected to Teen with a 13+
    floor. Calories now render as `~N kcal`.
  - Verified clean and worth not re-litigating: the media kill switch holds
    (no gif URL is ever persisted, so no stale-cache path can resurrect a
    fetch), the sounds really are synthesized (every one traces to an
    `ffmpeg aevalsrc` chain with no input file), the dependency tree has no
    copyleft or non-commercial licence across 614 packages, OpenPowerlifting
    data is public domain, and billing is genuinely unreachable rather than
    merely disabled.
  - **Left open, needing a decision rather than code:** the ExerciseDB data
    licence, the provenance of `assets/Streak.json`, and the missing
    UGC report/block mechanism. See the "Play compliance" section in
    CLAUDE.md.

- **2026-09-04:** both ways out of a live session now confirm. Discard
  opens a red ConfirmModal that counts the logged sets about to be lost;
  Finish opens a lime one (new `tone="accent"` on ConfirmModal, the only
  change to the shell) that says how many sets are saved and how many
  unticked ones will be dropped, since `finishWorkout()` silently filters
  those out. The finish side effects (sound, summary) moved into the
  confirm handler unchanged.
- **2026-09-04:** dock idle tabs are solid ink (`C.ink`) instead of
  `rgba(255,255,255,0.6)`. The translucent white read as dimmed or disabled
  on the dark dock; active is still told apart by lime plus the rail.
- **2026-09-04:** the streak dialog's trained-day dot is a solid lime disc
  with an accentInk check. It was an orange gradient left over from the
  flame era, the last non-brand colour in that overlay.

- **2026-09-04:** the rank badge is the HEX TRACK. Adilzhan asked for a better
  badge design keeping the vortex, the tier metals and the hexagon. Four
  proposals were drawn live in SVG as artifacts: "Torq Badge Ladder" (hex
  track + one detail per tier), then, after a web pass over game and fitness
  ladders (Overwatch's count-the-shapes rule, Riot's single reusable
  silhouette, Valorant's motion-only-at-the-summit, IWF plate colours, belt
  stripes), "Torq Badge Concepts" with Loaded Bar, Momentum and Cut Stone.
  A Loaded Bar second pass (tapering plates tight to the shield, bar earned
  per tier) was built and then dropped; the hex track won with the emblem a
  tenth smaller. `RankBadge.tsx` was rewritten around a `DETAIL` flag table
  and the sampled-polyline gem; the ellipse orbit and its under/over ball
  cross-fade are gone. README shots for home, ranks and profile re-shot, hero
  rebuilt; the other framed PNGs came out pixel-identical and were restored
  from git so the diff stays honest. App.tsx ignores the offline-fetch
  LogBox patterns, because the toast parked over the dock blocked the whole
  emulator test loop. The Supabase project host itself returns NXDOMAIN
  (paused or deleted), which is the real error behind those toasts.
- **2026-09-04, later:** badge sizing pass after Adilzhan saw the hex track
  on the phone: emblem up to 72 (from 60), a single exported `BADGE_ROW = 96`
  for Home, Profile and the Ranks lift rows (replacing 68 / 64 / 46 / 62),
  and `animated` defaulting to true so every badge on every page is alive,
  with ShareCard opting out because it captures to an image. README shots for
  home, ranks and profile re-shot, hero rebuilt.
- **2026-09-04, batch 2 (TODO 1 + 2):** data integrity and sync. Unit
  switching now CONVERTS every stored weight (`convertDB`), instead of the
  planned "store kg internally" rewrite: the "weights are in the user's unit"
  invariant is assumed by sixty display and input sites, so keeping it and
  converting on switch is the smaller, safer change. `db.ts` validates the
  blob's shape (a `workouts: null` used to crash every screen and then get
  saved back as the truth), reports a failed save through `saveError` (App
  banner) instead of an unhandled rejection, coalesces writes (one in
  flight, one queued) and makes `wipeLocal` wait for the queue. The store
  replaces arrays on every mutation, so `useMemo([workouts])` recomputes
  after `finishWorkout`. `sync.ts` was reordered to PULL, RESOLVE on the
  client stamp (clamped to cycle time + 5 min), then PUSH: the server
  `updated_at` is only the pull cursor now, which ends last-pusher-wins.
  Tombstones are forgotten only once acknowledged, pulled settings merge over
  defaults, a live session is never replaced by another device's copy, and
  own echoes are skipped. The client is injectable, and `sync.test.ts` runs
  the cycle against an in-memory server with a fake clock (Date pinned via
  vi.setSystemTime, which the first version forgot). 17 new tests.
