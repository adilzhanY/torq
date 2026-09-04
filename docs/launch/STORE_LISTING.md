# Play Store listing

Copy for Play Console → Main store listing. Character limits are Google's;
the counts below are the current drafts.

**Only the text inside the fenced blocks goes into Play Console.** Everything
outside them is commentary for us. This matters: the prose below names
competitors, and Play's store listing policy forbids referencing other apps
or brands in listing metadata. Pasting a whole section of this file into the
console would carry that text in with it.

## App name (30 max)

```
torq, rank your strength
```
*(24)*

## Short description (80 max)

```
Log your lifts and find out how strong you actually are, ranked against real data.
```
*(80)*

The pitch is deliberately the question every other tracker leaves unanswered.
Strong and Hevy answer "what did I do?"; the short description has one line
to say torq answers "how good am I?".

## Full description (4000 max)

```
Most workout trackers tell you what you did. torq tells you how good it was.

Log your session, and torq scores every lift against real competition data,
normalized for your bodyweight and sex, so a 60 kg lifter and a 95 kg lifter
are compared fairly. You get a tier, a points score, and an honest answer to
the question you actually care about.

RANK EVERY LIFT
• Nine tiers, from Rust to World Class
• Scored with DOTS, the same normalization powerlifting meets use
• See exactly how many kilos stand between you and the next tier

KNOW WHERE YOU STAND
• Percentiles from up to 400,000 competitive raw lifters per lift
• World-record marks for your weight class, next to your own numbers
• No vague "intermediate/advanced" labels, real distributions

TRAIN WITH FRIENDS
• Compare lift by lift with people you actually train with
• A feed of your friends' rank-ups
• An opt-in global leaderboard when you want a bigger room

A PROPER TRAINING LOG
• Fast set logging with rest timers and per-set rest
• 1,500 exercises with step-by-step instructions and muscle maps
• Suggested weights that follow double progression, it notices when you
  stall and tells you when to deload
• A training plan built around the days you can actually train
• Charts for every lift: estimated 1RM, top weight, volume, reps

YOURS, NOT OURS
• Works completely offline. An account is optional
• Your workout logs are never shown to other users. Friends see your
  rank and your top lifts, nothing else
• Export everything as a file whenever you like
• Delete your account from inside the app

Logging your workouts is free.
```

## Graphics checklist

| Asset | Spec | Notes |
| --- | --- | --- |
| App icon | 512×512 PNG | `assets/icon.png`: the vortex mark |
| Feature graphic | 1024×500 | Lime vortex on #0E0F0E, wordmark + "rank your strength" |
| Phone screenshots | 2-8, min 1080px | Order below |
| Short promo video | optional | The rank share card animating is the obvious hook |

### Screenshot order (the first two are what people actually see)

1. **The Ranks tab**, big shield, tier, points. The differentiator, first.
2. **An exercise Rank tab**, percentile + world-record line.
3. **The live session**, set logging with the rest bar running.
4. **Friends compare**, two badges head to head.
5. **Home**, today's plan and the week strip.
6. **Charts**, estimated 1RM climbing.

Caption each with the benefit, not the feature name.

## Category and tags

- Category: **Health & Fitness**
- Tags: workout tracker, gym, strength training, powerlifting, fitness

## Content rating

Answer the IARC questionnaire honestly. torq has no objectionable content,
but it is **not** an "Everyone" app, and answering that way is a
misdeclaration.

The app has unmoderated user-to-user interaction: searchable handles, free
text display names, uploaded profile pictures, friend requests and a global
leaderboard. Declare all of it. Expect **Teen / PEGI 12** as a result, which
is the correct outcome and costs nothing.

Target audience: **13+ at the lowest**. Do not include under-13. That pulls
the app into Families policy, which would require locking down the whole
social layer.

Ads: **none**.

## Before you can publish

- [ ] Privacy policy URL live and public (`docs/launch/PRIVACY.md`, host it,
      GitHub Pages is enough)
- [ ] Web account-deletion URL live on the same host. Play wants a page a
      person can reach without installing the app, not only the in-app path
- [ ] Data Safety form filled from `DATA_SAFETY.md`
- [ ] Content rating questionnaire done
- [ ] Target audience and ads declaration (no ads)
- [ ] Closed test: **12 testers for 14 continuous days**, see LAUNCH.md
