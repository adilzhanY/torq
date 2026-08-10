# Play Store listing

Copy for Play Console → Main store listing. Character limits are Google's;
the counts below are the current drafts.

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
Every workout tracker tells you what you did. torq tells you how good it was.

Log your session, and torq scores every lift against real competition data,
normalized for your bodyweight and sex, so a 60 kg lifter and a 95 kg lifter
are compared fairly. You get a tier, a points score, and an honest answer to
the question you actually care about.

RANK EVERY LIFT
• Nine tiers, from Rust to World Class
• Scored with DOTS, the same normalization powerlifting meets use
• See exactly how many kilos stand between you and the next tier

KNOW WHERE YOU STAND
• Percentiles built from 2.2 million competition results
• World-record marks for your weight class, next to your own numbers
• No vague "intermediate/advanced" labels, real distributions

TRAIN WITH FRIENDS
• Compare lift by lift with people you actually train with
• A feed of your friends' rank-ups
• An opt-in global leaderboard when you want a bigger room

A PROPER TRAINING LOG
• Fast set logging with rest timers and per-set rest
• 1500+ exercises with demonstrations
• Suggested weights that follow double progression, it notices when you
  stall and tells you when to deload
• A training plan built around the days you can actually train
• Charts for every lift: estimated 1RM, top weight, volume, reps

YOURS, NOT OURS
• Works completely offline. An account is optional
• Your workout logs are never shown to other users, only a computed rank
• Export everything as a file whenever you like
• Delete your account from inside the app, in two taps

Free to log. Always.
```

## Graphics checklist

| Asset | Spec | Notes |
| --- | --- | --- |
| App icon | 512×512 PNG | `assets/icon.png`: the vortex mark |
| Feature graphic | 1024×500 | Lime vortex on #0E0F0E, wordmark + "rank your strength" |
| Phone screenshots | 2–8, min 1080px | Order below |
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

Answer the IARC questionnaire honestly; torq has no objectionable content
and should come back **Everyone**. It does have user-to-user interaction
(friends and handles), declare that. It is a required question.

## Before you can publish

- [ ] Privacy policy URL live and public (`docs/launch/PRIVACY.md`, host it,
      GitHub Pages is enough)
- [ ] Data Safety form filled from `DATA_SAFETY.md`
- [ ] Content rating questionnaire done
- [ ] Target audience and ads declaration (no ads)
- [ ] Closed test: **12 testers for 14 continuous days**, see LAUNCH.md
