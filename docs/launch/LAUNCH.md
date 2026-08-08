# Launch playbook

PATH.md's Phase 4 plan, turned into an ordered checklist. The sequencing
matters more than the individual steps: two of these have hard waiting
periods, and doing them late costs weeks.

## The two things that cost time if started late

1. **Closed testing: 12 testers, 14 continuous days.** New personal Play
   developer accounts cannot publish to production until they have run a
   closed test with at least 12 testers who stay opted in for 14 straight
   days. The clock only runs while you have 12. Start recruiting before the
   app feels finished.
2. **Pre-registration** runs for weeks, not days, and is the Android
   equivalent of the pre-orders in the Runify story. It also auto-installs
   on launch day for everyone who signed up, which is the single best
   launch-day spike available. Set it up while the closed test runs.

Everything else can be done in an afternoon.

## Order of operations

### Phase A — before any store work
- [ ] Verify the app on a real device end to end. A large amount has shipped
      without a device pass.
- [ ] Wire Play Billing and decide the free/paid split and price
      (`src/lib/entitlements.ts` holds the split; PATH.md still lists both as
      open questions).
- [ ] Re-verify the world-record table against the official IPF database —
      it is a dated snapshot and records have already moved past it.
- [ ] Push notifications: FCM credentials, deploy the function, add the
      webhooks (`supabase/functions/notify/README.md`).

### Phase B — Play Console setup
- [ ] Create the app, package `com.torq.app`.
- [ ] Host the privacy policy and paste the URL.
- [ ] Data Safety form from `DATA_SAFETY.md`.
- [ ] Content rating, target audience, ads declaration (no ads).
- [ ] Store listing from `STORE_LISTING.md` + graphics.
- [ ] Production release keystore. **Back it up.** Losing it means never
      updating this app again under the same listing.

### Phase C — testing
- [ ] Internal testing track: your own devices, instant.
- [ ] Closed test with 12+ testers, 14 continuous days.
- [ ] Fix what they report. This is the only pre-launch signal you will get.

### Phase D — pre-registration and content
- [ ] Turn on pre-registration with the finished listing.
- [ ] Short-form content run-up. The share cards are the content engine:
      a rank card and a rank-up are both natively postable, which is why
      they were built first-class.
- [ ] Decide the launch date once the closed test has actually cleared.

### Phase E — launch
- [ ] Promote to production.
- [ ] Watch crash rate and ANRs in Play Console for the first 48 hours.
- [ ] Have a staged rollout (start at 20%) so a bad build is not everyone's
      problem.

## Monetization notes

- Play Billing takes **15%** on the first $1M per year.
- Price **below** the iOS incumbents. Android ARPU is roughly half of iOS,
  so the plan is volume and price, not margin per user.
- The free tier must stay a complete tracker. Backup is free too —
  see the reasoning in `src/lib/entitlements.ts`. A user who feels their
  history is hostage will not recommend the app to anyone.

## Things that are NOT ready yet

- Billing is not wired; every paid feature is currently unlocked.
- Regional leaderboards need a country, which nothing collects.
- Video verification for top-of-ladder claims does not exist; the
  `verified` flag is present but nothing sets it.
- Seven women's squat world-record cells are uncurated (the app says so
  rather than hiding it).
