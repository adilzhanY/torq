# TODO

Working list, ordered by what hurts users most. Tick items as they land and
move the "why" into docs/HISTORY.md. Sources for the research-derived items
are at the bottom. "Big" items are rewrites; do them in one go, do not patch
around them.

## 0. Rules for working this list

- Reproduce first (a test in `src/lib/__tests__` for logic, the emulator for UI).
- Every fix that touches `src/lib` gets a test in the same commit.
- Do not add a dependency that is not in Expo Go unless the item says so.
- `npm run tsc && npm test` before every commit.

## 1. Data integrity (can lose or corrupt a user's history)

- [x] **Unit switching converts nothing.** `Settings.tsx` writes `unit` and every
      stored weight is reinterpreted. DECIDED 2026-09-04: weights STAY in the
      user's unit (60+ display and input sites already assume it) and the unit
      switch CONVERTS the data (`convertDB` in units.ts, called from
      `updateSettings`). Same invariant, one function, tested. The subtasks
      below are therefore moot and ticked as "not needed".
  - [x] Migration in `db.ts`: if `settings.unit === "lb"` and `schemaVersion < 2`,
        convert every set, routine, measurement and bodyweight to kg once.
  - [x] `NumberField` for weight takes and shows the user unit, stores kg.
  - [x] `suggest.ts` / `progress.ts` / `plates.ts` / `plausibility.ts` drop their
        `LB_TO_KG` branches.
  - [x] Tests: round-trip 100 lb -> kg -> lb, plates with a 20 kg vs 45 lb bar.
- [x] **Sign-out leaks the previous user's data into the next account.**
      `auth.tsx signOut` must call `wipeLocalData()` + `resetSyncCursor()` after
      offering export. Guest -> account must NOT wipe (that is the upgrade path).
- [x] **`saveDB` failures are silent.** Wrap in try/catch, surface a persistent
      "could not save" banner via the store, retry on next commit.
- [x] **`loadDB` does no shape validation.** `Array.isArray` per table, else
      park the blob under `BACKUP_KEY` and flag `loadError`.
- [x] **`finishWorkout` pushes into the same array.** Replace arrays on every
      mutation (`[...arr, x]`) so `useMemo([workouts])` recomputes. Audit every
      `.push(` in `store.tsx`.
- [x] **`wipeLocal` can race a pending `saveDB`.** Await the in-flight save
      (keep a promise on the store) before wiping.

## 2. Sync (two devices must not eat each other's edits). Big.

- [x] Server trigger overwrites `updated_at`, so LWW is last-pusher-wins. Fix:
      keep the client stamp in `data.updatedAt`, use the trigger column only as
      the pull cursor. Resolve conflicts on `data.updatedAt`, clamped to server
      time + 5 min to stop lying clocks.
- [x] Tombstones are dropped by timestamp each cycle; deletes made mid-sync
      resurrect. Drop only tombstones that were actually pushed (track ids).
- [x] Pulled `settings` replaces the whole object; merge over `DEFAULT_SETTINGS`
      and prefer local for `unit`.
- [x] `active` pulled wholesale can overwrite the session being logged. Never
      pull `active` while `activeWorkout` is non-null locally.
- [x] Own pushes come back on the next pull and re-dirty every row (ping-pong
      every 30 s). Record `lastPushedAt` per row and skip rows whose server
      stamp equals it.
- [ ] One failing table aborts the whole cycle and never advances cursors.
      Per-table try/catch, per-table cursors, surface the failing table.
- [ ] Sync status in Settings: last success time, last error, "Sync now" that
      reports failure. Backoff (30 s -> 5 min) instead of a fixed timer.
- [x] Tests for `sync.ts` with a fake Supabase client: push/pull, tombstone,
      conflict, settings merge, failing table.
- [ ] Research says (Bambini, Couchbase, welcomedeveloper): LWW is fine for
      single-owner data like ours, but use server receive time or a hybrid
      logical clock, never the bare device clock. HLC is overkill here; the
      clamp above is enough.

## 3. Supabase security (before any public build)

- [x] `friendships` UPDATE policy lets the addressee rewrite `requester`.
      `with check` must pin `requester` and `addressee` to their old values.
- [ ] `notify` edge function trusts its POST body. Verify a webhook secret
      header and re-read the row from the DB before fanning out.
- [ ] `rank_events` and `friendships` inserts have no rate limit; each insert
      pushes. Add a per-user rate limit in the function (or a trigger) and a
      unique index on `(user_id, to_tier)` for events.
- [ ] `avatars` bucket is public. Make it private + signed URLs, or drop avatar
      upload and use initials (also removes most of the Play UGC surface, see
      CLAUDE.md "Play compliance").
- [ ] `search_profiles` returns `user_id` and matches 2-char substrings.
      Return handle + display name only; require 3 chars; prefix match on
      handle, substring only on display name.
- [ ] `bodyweight_kg` and `sex` are uploaded on every publish and never read
      back. Stop sending them; drop the columns.
- [ ] `claimPendingHandle` publishes `visible = true` without consent. Ask.
- [ ] Report + block for user content (Play UGC policy). `reports` table,
      `blocked` honoured by `sendRequest` and `search_profiles`, server-side
      display-name constraint.

## 4. Weight progression (the product's core promise)

- [x] `deloadWeight` returns heavier than input under 2 x step. Clamp to
      `min(weight, ...)`. Test the boundary.
- [ ] Deload sessions are stored as real history, so the next week progresses
      from the deloaded weight. Mark sets `deloaded: true` and make
      `suggestWeight` skip them when finding the last working weight.
- [x] Double deload (suggest.ts "deload" kind + store ease 0.85). One place
      decides.
- [ ] `startRecommended` bypasses the suggestion engine. Route it through the
      same prefill as `startWorkout`.
- [ ] Failure sets: `workingSets` counts them, `lastSetsFor` drops them. Decide
      once (count the attempt, keep the row) and test.
- [x] `prevTop === topWeight` float equality. Compare with a tolerance.
- [x] Rep cap: a 20-rep set at the same weight should not satisfy a 5-rep
      target. Require reps within [target, target + 5].
- [ ] Warmups never progress with the working weight. Regenerate from the
      warm-up ramp when the working weight changes.
- [ ] Reps > 10 are invisible to ranks with no UI explanation. Show "log a set
      of 10 or fewer reps to rank this lift" on the exercise Rank tab.
- [ ] Tests for `store.tsx` prefill: first session, second session hit,
      second session miss, deload week, recommended template, lb user.

## 5. Live session UX

- [x] Number parsing: accept "1,5", reject negatives and letters, never clear
      the field while typing (keep the raw string in local state, commit on
      blur). Same fix in Onboarding and RoutineEditor.
- [ ] Rest timer survives tab switch, background and app kill: store
      `restEndsAt` in `activeWorkout`, schedule a local notification, recompute
      on resume via `AppState`.
- [ ] Debounce `saveDB` (300 ms trailing) and keep the in-memory ref as the
      source of truth. Flush on background.
- [ ] `findGhost` and `prevSetsFor` rescan history per keystroke. Memo on
      `workouts` + `exerciseId`, not on the live workout object.
- [ ] Set tick is 32 px with no hit slop. 44 dp minimum, hit slop on the
      type letter and the rest divider.
- [ ] Finish disabled with no reason when nothing is ticked. Show why, offer
      "tick all".
- [ ] "Add set" should copy type and rest of the previous set.
- [ ] Deleting an exercise shifts indices held by open menus and the running
      rest. Key rest/menus by set id, not index.
- [ ] `weightRefs` never pruned after delete; Skip can focus the wrong row.
- [ ] Next-field chaining: weight -> reps -> tick with `returnKeyType="next"`.
- [ ] `KeyboardAware` only corrects on keyboardDidShow; also on focus change.
- [ ] SwipeToDelete commits on velocity alone; require distance too.
- [ ] Routines empty state has no "create routine" action.

## 6. Performance (measure before and after, on the emulator with a year of seeded history)

- [ ] Store context value rebuilt every render; memoise `value` and the action
      closures (`useCallback` or a stable actions object).
- [ ] Profile recomputes ranks, streak, volume in render. `useMemo`.
- [ ] Home `fatigueCheck` and Stats `wrappedFor` memo on `now`, which changes
      every render. Round `now` to the minute.
- [ ] `computeStreak` iterates day by day from the first workout. Walk workout
      days, not calendar days.
- [ ] Ranks `pctOf` / `name()` do `exercises.find` per row. Build a Map once.
- [ ] `TrainingLoadPage` recomputes everything in render.
- [ ] Badge animations: cap concurrent animated badges (e.g. only rows on
      screen, `animated={visible}`), measure with the Hermes profiler.
- [ ] ExerciseBrowser rebuilds 1500 rows per keystroke; precompute a search
      index once, debounce the query.
- [ ] Consider MMKV for the DB blob (30x faster than AsyncStorage, JSI, no
      bridge). NOT in Expo Go, so only when we move to a dev build. Research:
      netguru, pkgpulse 2026 guide.
- [ ] Research says (RapidNative 2026 playbook): FlashList for any list longer
      than a screen. History and the exercise library qualify.

## 7. Accessibility (zero labels today)

- [ ] `accessibilityLabel` + `accessibilityRole` on every icon-only control:
      set tick, set type letter, "..." menus, delete, rest +/-20, dock tabs,
      avatar, calendar, share.
- [ ] 48 dp touch targets everywhere (RN docs, accessibilitychecker.org).
- [ ] `accessibilityState` for selected tabs and ticked sets.
- [ ] Reduce motion: honour `AccessibilityInfo.isReduceMotionEnabled` for
      badge loops and Squish.
- [ ] Dynamic type: check the live session at 130% font scale.

## 8. Correctness and polish

- [ ] Bodyweight always labelled kg. Use `settings.unit` and convert.
- [ ] `ProgressCharts` row `key={r.label}` can collide; key by exercise id.
- [ ] Long exercise names run under the delta column in the dumbbell chart.
- [ ] Home tile subtitle takes the last word of a name ("Degrees").
- [ ] Streak modal `setTimeout` has no cleanup.
- [ ] `CustomModal` cannot scroll; small screens lose the buttons.
- [ ] `ShareCard` fixed 300 x 375 overflows 320 dp devices.
- [ ] Empty states on Stats "What moved", "Closest tier-ups", "Recent records".
- [ ] Three copies of `dayStart` / `addDays`; one in `lib/dates.ts`.
- [ ] 17 hardcoded `rgba(200,254,35,...)`; add `C.accentAlpha(a)`.
- [ ] `StreakPill.todayPending` and `ErrorBoundary.onReset` are dead.
- [ ] `handleTaken` returns false on error; show "could not check" instead.
- [ ] Auth gate `getSession` needs a catch and a timeout, then fall back to
      local mode.
- [ ] Sync failures silent; Settings shows last sync + error.
- [ ] Friends tab requests push permission on mount; show rationale first.
- [ ] `exportData` leaves the unencrypted DB in cache; delete after share.
- [ ] Calories bills rest after the last set.

## 9. Tests to add (in this order)

- [ ] `store.test.ts`: prefill and finish paths (see section 4).
- [x] `sync.test.ts` with a fake client (see section 2).
- [x] `db.test.ts`: corrupt blob, missing tables, settings merge, migration.
- [x] `units.test.ts`: round trips and boundaries.
- [x] `deload.test.ts`: below 2 x step.
- [ ] `stats.test.ts`: `lastSetsFor`, `exerciseSeries`.
- [ ] `progress.test.ts`: `pointsPerWorkout`.
- [ ] `percentile.test.ts`: monotonic guard.
- [ ] Component smoke tests with react-native-testing-library for the live
      session (render, type, tick, finish). Needs the RN preset in vitest or a
      jest lane.

## 10. Research notes (kept only where they apply to Torq)

- Re-renders come from unstable props and unfocused context providers; split
  the store context into data and actions, memoise both.
  https://www.rapidnative.com/blogs/react-native-performance-optimization-2026-playbook
- FlashList over FlatList for long lists; getItemLayout where FlatList stays.
  https://quokkalabs.com/blog/react-native-performance/
- MMKV vs AsyncStorage: 30x faster, JSI, not in Expo Go.
  https://www.netguru.com/blog/mmkv-react-native-storage
  https://www.pkgpulse.com/guides/react-native-mmkv-vs-async-storage-vs-expo-secure-store-2026
- Accessibility: 48 dp targets, label adds meaning rather than repeating text,
  hint for what happens, role for what it is.
  https://reactnative.dev/docs/accessibility
  https://www.accessibilitychecker.org/blog/react-native-accessibility/
- LWW is acceptable for single-owner data, but never on the device clock;
  tombstones must propagate, never be dropped before they are acknowledged.
  https://marcobambini.substack.com/p/the-secret-life-of-a-local-first
  https://www.welcomedeveloper.com/posts/local-first-architecture-5-bidirectional-sync/
  https://oneuptime.com/blog/post/2026-01-30-last-write-wins/view
