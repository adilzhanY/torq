# PATH.md - where torq is going

The product/business roadmap for torq. CLAUDE.md records where the code IS;
this file records where the project is GOING and why. Written 2026-08-04 after
the rank-redesign planning sessions. Update it when a decision changes or a
phase completes.

## The business idea

Inspired by the Caleb Dean / Runify story (built a running app in public,
validated with short-form content and pre-orders before writing code, sold at
5x ARR while keeping equity). Adilzhan's version, Android-first:

- Build something **pretty and catchy** that regular gym-goers want, not a
  developer tool.
- **Advertise on social media** with short-form content (the app's share cards
  and rank-ups are the content engine).
- **Sell it for money**, priced cheaper than the iOS competitors (Android ARPU
  is roughly half of iOS, so win on volume and price).
- Long-term: a sellable asset. Build in public, keep the option of an exit.

### Why torq can win

Every workout tracker (Strong, Hevy) answers "what did I do?". torq answers
**"how good am I, and compared to whom?"**:

- **Ranks per exercise and overall**, normalized by sex and bodyweight using
  real data, not vibes.
- **World-record mentions** next to your lifts ("the 74 kg raw record is
  261 kg, you are at 35% of it") for perspective and shareability.
- **Friends compare**: see friends' ranks and PRs, compete inside a circle
  you trust.

The moat is the curated standards dataset + the rank engine + the social
graph, none of which a Strong clone has.

## Locked decisions (2026-08-04)

1. **Rank engine: Hybrid.** Real percentiles from the OpenPowerlifting open
   CSV dump (sex x weight-class distributions) for the big barbell lifts;
   a calibrated points formula (DOTS / IPF-GL style) for the long tail of
   exercises. Never live-scraped: curated, versioned, bundled JSON.
2. **Social scope: Friends-first.** No global leaderboards until Phase 4.
   Friend-scoped visibility is self-policing and needs no moderation.
3. **Visual identity: Full rebrand.** The clay/lime "Strong clone" skin goes.
   - Logo: the **vortex mark** (2026-08-06, replaced the earlier sharp-tau
     direction — Adilzhan dropped the tau): eight sharp blades spinning
     around a center of force, lime `#C8FE23` on near-black `#0E0F0E`.
     Source art `assets/torq_logo_v2.png` (AI concept Adilzhan approved),
     traced to a single vector path (potrace) — lives in `Logo.tsx`,
     `assets/logo.svg`, all icon/splash assets, and as the rank-badge
     emblem.
   - Font: **Space Grotesk** (already shipped app-wide, 2026-08-04).
   - The name stays **torq**.
4. **Kickoff: Phase 1 now.** Rank math and data do not wait for the rebrand.

## Rank system design

- **Ladder (9 tiers):** Rust, Iron, Bronze, Silver, Gold, Platinum, Diamond,
  Elite, World Class.
- **Normalization:** sex + bodyweight are the only inputs to the math
  (science-backed, like powerlifting points formulas). Height and age show on
  the profile but stay OUT of the formula (no accepted formula exists).
- **e1RM:** Epley-estimated 1RM is rank-eligible only from sets of 10 reps or
  fewer. Warmups never count (consistent with the existing PR engine).
- **Data sources:** OpenPowerlifting dump for percentiles, IPF/IWF official
  records + Guinness for world-record mentions. Shipped as bundled JSON with
  a version stamp.
- **Anti-cheat (the Liftoff lesson):** friends-first visibility, plausibility
  caps relative to the world record for your class, "video verified" badge as
  a later feature. Never trust a global anonymous leaderboard.

## Architecture direction

- The existing private mirror-table sync (AsyncStorage blob + Supabase JSONB
  last-write-wins) stays untouched.
- Social is a **separate Supabase schema**: `profiles`, `friends`,
  `rank_snapshots` with friend-scoped RLS. Only computed snapshots are
  published, never raw workout logs.
- Share cards render client-side (react-native-view-shot or equivalent;
  verify against the Expo SDK 57 docs first, per AGENTS.md).
- Rank engine is pure TypeScript over the bundled dataset: offline-first,
  testable, no server round-trip to know your rank.

## Phases

### Phase 1 - Rank engine (APPROVED, in progress)
- Curate + bundle the standards dataset (percentiles per sex/weight class for
  the core lifts; formula calibration for the rest; records data).
- Pure rank math module: points, tier, percentile, "N pts to next tier".
- Ranks surfaces: overall Rank Card on the profile, per-exercise rank page
  with the world-record mention, tier badges in exercise info.
- Done so far: Space Grotesk shipped; vortex logo shipped app-wide;
  rank engine v1 live (`src/lib/rank.ts`: DOTS points normalized by
  sex+bodyweight, 9-tier ladder on calibrated thresholds, best-e1RM
  extraction with the ≤10-rep/no-warmup rule) + the Rank Card in Profile
  (overall tier, points, progress-to-next, top-3 best lifts); Ranks tab
  shipped (shield badges ported to react-native-svg — tier metals, vortex
  emblem, orbit stages I–IV from tier progress; overall + per-lift rows);
  per-exercise rank page (a "Rank" tab in ExerciseInfo: big badge, tier
  label, points, progress to the next tier in both pts and kg, plus the
  world-record mention) reachable by tapping a Ranks row, with the tier
  badge also in the info-page header.
  Honest scope: points and tiers only — no percentile claims until the
  OpenPowerlifting dataset is curated and bundled.
- `src/data/records.ts` now holds SOURCED IPF-classic records
  (`ipf-classic-2026.1`, checked 2026-08-08) with record holders: men's
  three lifts and women's bench + deadlift from the published
  garagegymreviews record tables, women's 84 kg squat from the 2026
  Sheffield reports. OPEN: the other seven women's SQUAT classes are `null`
  (that source's women's-squat table is a duplicate of its bench table), so
  those users see no squat record line — fill them from the official IPF
  database, and re-check the whole table before public release.
- OPEN: the OpenPowerlifting percentile tables (the other half of the
  hybrid engine) are still not curated or bundled.

### Phase 2 - Full rebrand
- New visual system (palette to be finalized around the sharp tau + lime on
  near-black direction), applied screen by screen starting with the new
  Ranks surfaces, then Home, live session, and the rest.
- New app icon, splash, and the rank-badge family derived from the tau.

### Phase 3 - Social (IN PROGRESS — core shipped, polish left)
- Public profile (opt-in), friend requests, friends list. **SHIPPED
  2026-08-08**: `supabase/social.sql` (profiles / friendships /
  rank_snapshots, friend-scoped RLS, `are_friends()` +
  `find_profile()` / `handle_taken()` RPCs), `src/lib/social.ts`, and the
  Friends view behind the You/Friends switch in the Ranks tab. Only a
  handle, a display name and a COMPUTED rank snapshot ever leave the
  device — never workout logs. Discovery is exact-handle only: no listing,
  no prefix search, nothing to enumerate.
- Friends compare: **SHIPPED 2026-08-08** — tapping a friend opens
  `FriendCompare`: two badge columns, the points lead, then a lift-by-lift
  table. Compared on DOTS POINTS, never raw kilos (comparing kilos would
  undo the whole normalization). Feed of friends' rank-ups **SHIPPED
  2026-08-08**: a `rank_events` row per TIER change (points tick constantly,
  tiers do not), written by the device when it publishes a snapshot and sees
  the stored tier differs. PROMOTIONS ONLY — a tier can fall when bodyweight
  rises, and "reached Silver" would be a lie on the way down. No event on a
  first publish (a new user must not spray "Rust → Gold" at their friends).
- Share cards: **SHIPPED 2026-08-08** — `ShareSheet` in
  `src/components/ShareCard.tsx` captures whatever face it is given as a
  1080×1350 PNG (react-native-view-shot `captureRef` + `expo-sharing`, both
  confirmed in Expo Go against the SDK 57 docs). Two faces so far:
  `ShareRankCard` (share button in the Ranks header) and `ShareWorkoutCard`
  (WorkoutSummary ⋯ → "Share as image", PRs first, falling back to the
  exercise list when the session set no records).

### Phase 4 - Arena + launch
- Global/regional leaderboards with the anti-cheat stack (plausibility caps,
  verified badge).
- Launch playbook: Google Play **pre-registration** (the Android equivalent
  of Apple pre-orders: auto-installs on launch day), short-form content
  streak leading up to it, closed test (12 testers / 14 days rule for new
  personal Play accounts) run well in advance.
- Monetization: freemium; core logging free, ranks/social/insights behind a
  cheap subscription or lifetime unlock (price BELOW the iOS incumbents).
  Play Billing takes 15% on the first $1M/yr.

## Open questions (decide when reached)

- Final rebrand palette (candidates from the logo round: volt lime evolution,
  metal tiers, clean break like signal orange or electric indigo).
- Exact free/paid feature split and the price point.
- Whether age joins the formula later (masters adjustments exist in
  powerlifting, e.g. McCulloch coefficients).
- Video verification UX for top-of-ladder claims.

## Reference material

- Plan + mockups: `~/dev/.lavish/torq-rank-redesign.html` (rank card, exercise
  rank page, friends compare, architecture diagram).
- Logo rounds: `~/dev/.lavish/torq-logo-ideas.html` (5 directions),
  `~/dev/.lavish/torq-tau-variants.html` (6 sharp tau treatments).
- Font tryout: `~/dev/.lavish/torq-font-tryouts.html`.
- Runify story (the inspiration): `~/Downloads/caleb-dean-runify-story.md`.
