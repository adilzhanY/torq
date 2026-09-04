# torq, Privacy Policy

**Last updated: 8 August 2026**

torq is a workout tracker built by Adilzhan Yelemessov. This policy explains
exactly what the app stores, where it goes, and how to get rid of it. It is
written to be read, not to be survived.

## The short version

- torq works **without an account**. If you never sign in, nothing you log
  ever leaves your phone.
- If you do sign in, your workouts are backed up to your own private space
  and are **not visible to anyone else**, not to other users, not to your
  friends.
- The only things other people can ever see are the things you deliberately
  publish: a handle, a display name, and a computed strength rank.
- We do not sell your data. We do not run ads. There is no analytics SDK and
  no third-party tracker in the app.

## What is stored on your phone

Everything you log: exercises, routines, workouts and sets, body
measurements, your training plan, and your settings (including the body
details you enter for calorie estimation, sex, birth year, height, weight).

If you never create an account, this never leaves the device, and deleting
the app deletes it.

## What is stored on our servers

Only if you create an account.

| Data | Why | Who can see it |
| --- | --- | --- |
| Email address | To sign you in and let you recover your account | Only you and the operator |
| Workouts, exercises, routines, measurements, settings | Backup and sync across your devices | **Only you** |
| Handle and display name | So friends can find you | Anyone, once you publish a profile |
| Rank snapshot (points, tier, your top lifts and their estimated 1RMs) | To compare ranks with friends | Your accepted friends. The Arena shows only your handle, display name, tier and points |
| The bodyweight and sex used to normalize that rank | DOTS scoring is meaningless without them | **Only you.** Stored on the same row, but no other user can read those two columns |
| Profile picture, if you set one | Shown next to your handle | Any signed-in user who can already see your handle |
| Rank-up events (a tier change) | The friends activity feed | Your accepted friends |
| Friend relationships | To know who your friends are | You and the other person |
| Push notification token | To tell you a friend request arrived | Only the server |

Your raw workout logs are **never** published to other users. What friends
see is the computed rank snapshot, not your sessions.

### Publishing is opt-in, twice

- Creating an account does **not** publish anything. Your profile is created
  only when you claim a handle, and it is invisible until you do.
- Appearing on the global Arena leaderboard is a **separate** opt-in on top
  of that. Having a public profile does not enter you into it.

Both can be switched off at any time.

## What we do not collect

- No location, no contacts, no health-platform data.
- No advertising identifiers.
- No analytics or crash-reporting SDK.
- No microphone or camera access. The app can open your photo library, but
  only when you tap to choose a profile picture, and only that one image is
  read.

We do collect **one photo**, if you choose to set a profile picture. It is
listed in the table above. Nothing else in your photo library is read.

## Third parties

- **Supabase** hosts the database, file storage and authentication. Data is
  stored under the project's region and protected by row-level security.
- **Expo Push Service / Firebase Cloud Messaging** deliver notifications, if
  you enable them. They receive a device token and the notification text.

Nothing else. No advertising or analytics vendor receives anything.

## Children

torq is not directed at children under 13 and we do not knowingly collect
their data.

## Your rights, and how to actually use them

- **Export**: Profile → Settings → *Export and delete* → *Export my data*.
  Produces a JSON file of everything stored on your device.
- **Delete your account**: Profile → Settings → *Export and delete* →
  *Delete my account*. This erases your account, workouts, rank,
  friendships, profile picture and notification tokens from the server
  **and** wipes the copy on your phone. It cannot be undone.
- **Erase locally without an account**: Profile → Settings → *Export and
  delete* → *Erase all data on this phone*.

You do not need to email anyone to do any of this.

## Contact

Questions or requests: **adilzhan1112@gmail.com**

## Changes

If this policy changes materially, the app will say so before the change
takes effect.
