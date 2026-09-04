# Play Data Safety: answer sheet

Fill this into Play Console → App content → Data safety. Every answer below
was checked against the code and the schema, not assumed. Where the honest
answer depends on a user choice, the rule is: **if any user can trigger it,
declare it.**

Google audits these against observed network traffic. An inaccurate
declaration is one of the most common reasons a release gets pulled, so do
not "simplify" the answers.

## Overall

| Question | Answer | Why |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** | An optional account stores email + workouts |
| Is all data encrypted in transit? | **Yes** | Supabase and Expo push are HTTPS-only |
| Do you provide a way to delete data? | **Yes** | In-app: Profile → Settings → Export and delete → Delete my account |

Deletion URL: Play wants a **web** page, not only an in-app path. It must be
reachable without installing the app and must be on the same host as the
privacy policy. Point it at the deletion page published alongside
`PRIVACY.md`, and keep `adilzhan1112@gmail.com` on that page as the contact
of last resort.

Getting the in-app path wrong here is a real rejection cause: a reviewer
follows this string literally, and the section lives under Settings, not
directly under Profile.

## Data types to declare

### Personal info → Email address
- Collected: **Yes**. Shared: **No**.
- Processed **ephemerally**: No: it is stored.
- Required or optional: **Optional** (the app works without an account).
- Purposes: **Account management**.

### Personal info → Name
- Collected: **Yes** (display name / handle). Shared: **No**.
- Optional. Purposes: **Account management, App functionality**.
- Note: a handle is only created if the user claims one.

### Health and fitness → Fitness info
- Collected: **Yes** (workouts, sets, body measurements, bodyweight, sex,
  height, birth year). Shared: **No**.
- Optional (only leaves the device with an account).
- Purposes: **App functionality**.
- This is the one people get wrong: bodyweight and sex are collected because
  the rank engine normalizes on them, so they must be declared even though
  no screen in the app ever displays another user's bodyweight or sex.
- Be careful with the wording. This file used to claim they are "never shown
  to other users", which was true of the UI and false of the wire: both
  columns live on `rank_snapshots`, whose RLS lets an accepted friend read
  the row, and the client used to pull them down. Fixed 2026-08-17 with
  column-level grants in `supabase/social.sql` plus a narrowed select in
  `snapshotsByIds`. If either is ever reverted, this declaration becomes
  false again.

### Photos and videos → Photos
- Collected: **Yes** (an optional profile picture, chosen from the photo
  library). Shared: **No**.
- Optional. Purposes: **App functionality**.
- Declare it as collected even though it is optional and many users will
  never set one. The app opens the photo library (`src/lib/avatar.ts`) and
  uploads the chosen file to Supabase Storage.
- Note for the reviewer's benefit: the avatar is stored in a bucket serving
  public URLs, so other signed-in users can retrieve it. That is the same
  visibility as the handle it sits next to.

### App activity → Other user-generated content
- Collected: **Yes** (rank snapshots, rank-up events, workout notes).
- Shared: **No**: see the note below on "shared".
- Optional. Purposes: **App functionality**.

### Device or other IDs
- Collected: **Yes** (a push notification token, only if the user enables
  notifications). Shared: **No**.
- Optional. Purposes: **App functionality**.

## Types NOT collected: do not tick these

Location, contacts, audio, files, calendar, SMS, call logs, browsing
history, search history, installed apps, purchase history, financial info,
race/ethnicity, political or religious beliefs, sexual orientation, health
records beyond fitness, advertising ID, crash logs, diagnostics, product
interaction analytics.

**Photos are NOT on this list**, and used to be. The avatar picker collects
them. See the "Photos and videos" section above.

torq ships **no analytics or crash-reporting SDK**, so the "App info and
performance" section is entirely No.

## On the word "shared"

Play defines *sharing* as transfer to a **third party**. Publishing a rank to
another torq user is not third-party sharing. It stays inside the service,
so every row above answers **No** to shared. Do not confuse "other users can
see it" with "shared".

Be ready to explain in the review notes:

> Users may optionally publish a handle, display name and a computed
> strength rank so friends can compare ranks. Raw workout logs are never
> published to other users. Publishing requires two separate opt-ins
> (claiming a handle, then joining the leaderboard) and can be reversed.

## Third parties receiving data

- **Supabase**: processor for auth, database, storage, edge functions.
- **Expo Push Service / FCM**: processor for notification delivery only.

GitHub used to appear here as the host for exercise demonstration images.
Demo media was switched off on 2026-08-16
(`EXERCISE_MEDIA_ENABLED` in `src/lib/exercisedb.ts`), so the app makes no
such request and the entry was removed. Google matches this sheet against
observed traffic, and a declared destination that never appears is still an
inaccurate sheet. Put it back only if the flag is ever flipped on.

## Re-check this when

- Any analytics or crash reporting is added (it currently is not).
- Billing goes live, purchase history becomes a declarable type.
- Regional leaderboards land: they would need a country, which is a new
  personal-info type.
