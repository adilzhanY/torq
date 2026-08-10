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
| Do you provide a way to delete data? | **Yes** | In-app: Profile → Your data → Delete my account |

Deletion URL, if asked: point at the in-app path plus
`adilzhan1112@gmail.com`.

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
  they are never shown to other users.

### App activity → Other user-generated content
- Collected: **Yes** (rank snapshots, rank-up events, workout notes).
- Shared: **No**: see the note below on "shared".
- Optional. Purposes: **App functionality**.

### Device or other IDs
- Collected: **Yes** (a push notification token, only if the user enables
  notifications). Shared: **No**.
- Optional. Purposes: **App functionality**.

## Types NOT collected: do not tick these

Location, contacts, photos/videos, audio, files, calendar, SMS, call logs,
browsing history, search history, installed apps, purchase history,
financial info, race/ethnicity, political or religious beliefs, sexual
orientation, health records beyond fitness, advertising ID, crash logs,
diagnostics, product interaction analytics.

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

- **Supabase**: processor for auth, database, edge functions.
- **Expo Push Service / FCM**: processor for notification delivery only.
- **GitHub (raw.githubusercontent.com)**: serves exercise images. Receives
  the image request only, no account data.

## Re-check this when

- Any analytics or crash reporting is added (it currently is not).
- Billing goes live, purchase history becomes a declarable type.
- Regional leaderboards land: they would need a country, which is a new
  personal-info type.
