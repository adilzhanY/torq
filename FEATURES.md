# The premium feature slate

Ten features chosen 2026-08-11 (lavish review `.lavish/torq-features.html`).
The filter: every idea must compound something torq ALREADY owns (the DOTS
rank engine, the OpenPowerlifting percentile data, the plan generator, the
live logger, the friends graph) rather than being generic gym-app filler a
competitor can copy in a week.

Strategy: build features first, distribute them into subscription tiers
later. Every feature lands as a row in `src/lib/entitlements.ts`'s `FEATURES`
table, so re-tiering is a one-line edit. That seam exists for exactly this.

Build cost: S = days · M = 1 to 2 weeks · L = weeks plus backend.

## Pillar 1 · Compete (the rank system is the moat; deepen it)

### 1. Seasons · FLAGSHIP · M
Quarterly competitive seasons, like every game the users already play. The
rank still climbs forever, but each season awards a sealed MEDAL for where
you finished and what you gained, archived on the profile forever.
- Why torq: `tierDates` + `rankHistory` already replay any window, so a
  season is a date-range query over existing code. Medals reuse the badge
  art. Seasons fix the rank system's one flaw: after a plateau the number
  stops moving, and a season resets the RACE without resetting the RANK.

### 2. Leagues · L
Monthly cohorts of ~30 lifters at your level, Duolingo style: top 10
promote, bottom 10 demote. Not a global board you will never crack; thirty
people you can actually beat.
- Why torq: ranked on DOTS GAIN, not total, so a beginner and an elite share
  a league fairly, which no strength app does. Needs a monthly cohort job
  plus a table; the scoring is `pointsPerWorkout`, already shipped. The
  Liftoff caution applies: entry stays opt-in, plausibility caps already
  gate published points.

### 3. Duels · M
Challenge a friend: most rank points gained in 30 days, winner takes a
trophy that sits on both profiles. One button from the existing compare
screen.
- Why torq: FriendCompare + `rank_snapshots` already exist; a duel is a row
  with two ids and a date range. The push-notification plumbing (built,
  undeployed) gets its killer use: "they just took the lead".

### 4. Wrapped · S
A monthly and yearly "Strength Wrapped": a swipeable stack of share cards.
Best session, kilos added per lift, percentile moved, the one chart that
shows the climb.
- Why torq: ShareCard's face system was built for exactly this (add faces,
  not capture code), and every number comes from `progress.ts`. Cheapest
  feature on the slate, and the only one that markets the app when posted.

## Pillar 2 · Coach (the data already knows; make it speak)

### 5. The PR Planner · FLAGSHIP · M
Name a goal ("100 kg bench by December") and torq answers with a
week-by-week attempt plan from the actual progression rate, and says
honestly when the date is fantasy, with the date that is not.
- Why torq: the progression slope comes from `rankHistory`, the plan
  mutation from the existing generator. Honesty is the brand: the same app
  that refuses to say "top N% of people" refuses to promise a fantasy PR.
  Coaching apps sell this exact promise dishonestly.

### 6. Weak-point radar · M
Squat : bench : deadlift balance measured against lifters LIKE YOU in the
OpenPowerlifting data, with the lagging lift named and two accessory
movements prescribed into the plan.
- Why torq: nobody else has the ratio norms, because they come from the same
  2.2M-lifter dump the percentiles came from; one more derived table from
  data already downloaded. Suggestions write into the plan via `applyPlan`.

### 7. Auto-deload · S
torq already detects two consecutive misses per lift. Zoomed out: when
several lifts stall in the same fortnight, it proposes a deload week and
builds it (same sessions, 85% loads, one tap to accept).
- Why torq: the stall signal lives in `suggest.ts` today, per lift.
  Aggregating it is a small pure function plus one card on Home. The plan
  generator already knows how to emit lighter weeks.

### 8. Pain-day swaps · S
"Shoulder is angry today." One tap on a live-session exercise swaps every
pressing movement for a same-muscle, joint-friendlier alternative from the
catalog, and remembers the preference until cleared. Not medical advice;
the user's call, remembered.
- Why torq: the 1,500-exercise catalog carries bodyPart, targetMuscles and
  equipment for every row, and the picker's replace flow already keeps set
  schemes. The substitution mapping table is the only new artifact.

## Pillar 3 · The gym floor (premium is also the next 90 seconds)

### 9. Ghost mode · S
Race your last session, live. A ghost line runs through the logger: what you
had lifted by this point last time, set by set, and whether you are ahead or
behind. A race against yourself instead of a form to fill.
- Why torq: `lastSetsFor` already replays the previous session into
  prefills; the ghost is the same data rendered as a live delta instead of
  grey text. Biggest feel-per-line-of-code on the slate.

### 10. Gym profiles + plate math · M
Tell torq what each gym has (bar weight, plate pairs, dumbbell run). Every
weight becomes tappable: exactly what to load per side, warm-up ramps
included; the picker hides machines the current gym does not have;
suggestions snap to loads that exist.
- Why torq: `getWeightStep` already differentiates equipment; this makes it
  per gym and physical. The warm-up dialog's rounded numbers become loadable
  facts. Quietly the most-used premium feature in a serious lifter's day.

## Provisional tiering (a starting point, not a decision)

Principles already promised in code: logging, history and cloud backup stay
free forever (holding training data hostage is not a business model), and
nothing in the free tier gets worse. Free gets a taste of every pillar; Pro
is the daily-use depth; Club is the social layer that only works with money
behind the servers.

| Feature | Free | Pro (monthly) | Club (annual) |
|---|---|---|---|
| Seasons | current season + medal | full archive, medal styles | everything |
| Leagues | spectate | compete | compete + private leagues with friends |
| Duels | 1 active | unlimited | unlimited |
| Wrapped | yearly | monthly + share pack | everything |
| PR Planner | 1 goal | unlimited goals + re-planning | everything |
| Weak-point radar | the headline ratio | full radar + prescriptions | everything |
| Auto-deload | the warning | the built deload week | everything |
| Pain-day swaps | not included | included | everything |
| Ghost mode | weekly teaser | every session | everything |
| Gym profiles | 1 gym, plate math | unlimited gyms | everything |

## The trust problem (2026-08-11)

Discussed in the lavish review `.lavish/torq-trust.html`. The question that
started it: anyone can type "1000 kg bench" and torq has no camera and no AI
counting reps, so how can a global ranking mean anything?

### The finding that changes the premise

**Strava does not verify runs either.** Checked against their own docs and
press rather than assumed. What they actually do is auto-flag statistical
outliers (an 80 mph "ride", times several standard deviations off the board,
implausible watts per kilo, heart rate dropping to zero), hide those efforts
from leaderboards, and leave them untouched on the athlete's own profile.
They removed roughly 4.45 million activities that way, mostly mislabelled
activities and GPS glitches rather than villains, and they lean on community
flagging for the rest.

That is the SAME architecture `src/lib/plausibility.ts` already describes:
"The cap applies ONLY to what leaves the device. Your own logs and your own
Ranks screen keep showing exactly what you typed." So torq is not behind
Strava philosophically. Strava simply has more signals per activity and still
only reaches plausibility, never proof.

### Untangle three questions

1. **Verification** ("did this happen?") is impossible without a witness, a
   camera or instrumented hardware. Stop trying to solve it.
2. **Plausibility** ("could this have happened, for this person?") is pure
   statistics and catches essentially every typo and lazy fake.
3. **Accountability** ("who is harmed if it did not?") is a DESIGN question,
   and it is the strongest lever because it makes cheating not pay.

### The signal inventory

What a barbell app can observe, since nothing about a barbell is passively
measurable the way GPS is:

| Signal | What it exposes | Captured today |
|---|---|---|
| Session duration | 17 sets in 40 seconds is not a workout | yes (`startedAt`/`endedAt`) |
| Per-set timestamps | Real rest, lived vs backfilled, pace decay | **NO** |
| Warm-up structure | Nobody's first logged set is a 200 kg single | yes (set types) |
| Progression shape | Real curves rise, plateau, deload, wobble | yes (`rankHistory`) |
| Cross-lift ratios | A 200 kg bench with a 90 kg squat is strange | data on hand (OPL dump) |
| Bodyweight trend | DOTS divides by bodyweight | yes (measurements) |
| Edit/backfill behaviour | Numbers edited upward after the fact | no |
| Social graph | Collusion rings are dense mutual attestation | partial (friendships) |
| Competition results | Verified by a federation, not by us | data on hand (OPL dump) |

### The ladder of mechanisms

| Mechanism | Catches | Misses | Cost | Status |
|---|---|---|---|---|
| Plausibility caps | Typos, anything above a world record | Any believable lie | done | shipped |
| Realism scoring | Accounts with no training shape | A patient faker | S | needs per-set time |
| Velocity caps | Overnight jumps in ranked value | Slow inflation | S | not built |
| Community flags | What humans notice | Needs a crowd; harassment risk | M | not built |
| Partner co-sign | Casual fakes | Two friends colluding | M | not built |
| Video attestation | Almost everything filmed | Anything unfilmed; storage cost | L | flag column only |
| Federation link | Everything, genuinely | The ~99% who never compete | M | data downloaded |

No single mechanism works and they fail in different directions, which is
why they stack rather than compete.

### The three levers

- **Detectable:** the ladder above.
- **Expensive:** if ranked value only moves at a real progression rate and
  only from sessions that look lived, faking Diamond means simulating months
  of consistent, correctly paced training. The cheater has done the harder job.
- **Pointless (the deep one):** score leagues on GAIN not total, so a liar
  who starts at 300 kg has nothing left to gain; promotion pushes cheats into
  cohorts where they lose; and the liar corrupts their own PR planner,
  weak-point radar and auto-deload, so they vandalise their own product first.

### The unfair advantage

torq already downloads the OpenPowerlifting dump (2.2M lifters, names,
federations, meets, lifts) for percentiles. Letting a user claim their meet
result is REAL verification by a federation's judges, and no other gym app
can do it because no other gym app carries the data. It only covers the small
fraction who compete, but it makes the dead `profiles.verified` column mean
something and turns the Arena's "Verified only" filter into a real board.
It also gives a ground-truth sample: comparing self-reported torq numbers
against meet numbers for the same people is the first honest measurement of
how inflated an open board is.

### Do not build

- **AI rep/weight counting.** Unreliable in real gyms, needs a propped phone
  every set, and turns a logger into a filming app.
- **A mandatory camera.** The moment logging requires filming, ordinary users
  stop logging, and the product dies to protect a leaderboard.
- **An opaque cheat score.** Every rule should be one sentence a user can
  read, or support mail becomes unanswerable.
- **Public shaming.** No trust badges on profiles. The effort quietly stops
  counting on the board and stays exact in the person's own log.

### Trust build order

| Phase | Build | Why here |
|---|---|---|
| Now | Per-set `doneAt` timestamps | Pure capture, no UI change. You cannot audit history you did not record, so every month of delay is a month that can never be scored. |
| 1 | Velocity caps + realism scoring on published values | Pure functions over data you will then have, testable in vitest, never touching a personal log. |
| 2 | OpenPowerlifting link, Verified board made real | Turns a dead column into meaning, using a dataset already shipped. |
| 3 | Video attestation, community flags | Last: storage and moderation cost money, and only matter once a crowd exists. |

### Open questions

- How loudly to label the open board as self-reported (torq's voice says
  loudly, and consistency beats a slightly more exciting leaderboard).
- Whether velocity caps should affect your OWN Ranks screen or only what gets
  published. Capping only what is published keeps the personal log sacred.
- Whether a global board earns its cost at all, given friends and leagues
  carry most of the motivation with almost no trust machinery.

## Status (2026-08-11)

Five of the slate are BUILT, tested and verified on the emulator:

- **Per-set timestamps.** `WorkoutSet.doneAt` is recorded from now on. No UI
  reads it yet; it exists so the history is there when realism scoring and
  rest analytics are.
- **Ghost mode.** `src/lib/ghost.ts` plus a line in the live-session header.
- **Auto-deload.** `src/lib/deload.ts`, a Home card, and `Settings.deloadUntil`
  easing every prefilled weight to 85% for a week.
- **Wrapped.** `src/lib/wrapped.ts` plus a `ShareWrappedCard` face, entered
  from a card at the top of Progress.
- **Plate math**, the core of gym profiles: `src/lib/plates.ts` and a
  "Plate math" entry in the live-session exercise menu.

REMAINING from the gym-profiles idea, deliberately not built: several saved
gym profiles, a Settings screen for the bar and plate set (the fields
`Settings.barWeight` and `Settings.plates` exist and are honoured, nothing
writes them yet), hiding machines the current gym lacks, and snapping
suggestions to loadable weights via `nearestLoadable`.

Not started: Seasons, Leagues, Duels, PR Planner, weak-point radar,
pain-day swaps, and the whole trust ladder beyond the timestamps.
