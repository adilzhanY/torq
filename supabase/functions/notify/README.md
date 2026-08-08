# Push notifications — setup

Everything in the app and the Edge Function is written and committed. These
are the steps only you can do, because they need your Expo and Supabase
accounts.

**Nothing here works in Expo Go.** Remote push was dropped from Expo Go on
Android in SDK 53, so push only runs in a development or preview build. The
app degrades quietly in Expo Go rather than erroring, so the emulator loop is
unaffected.

## 1. FCM credentials (once)

Android push goes through Firebase Cloud Messaging. EAS can generate and
upload the credentials for you:

```bash
eas credentials -p android
# → select the profile → "Push Notifications: Manage your FCM Api Key"
```

Or follow https://docs.expo.dev/push-notifications/push-notifications-setup/
if you'd rather create the Firebase project by hand.

## 2. Run the SQL

`supabase/social.sql` now creates the `push_tokens` table. Re-run the whole
file in the SQL editor (it's idempotent).

## 3. Deploy the function

```bash
npx supabase login
npx supabase link --project-ref nknslhcvfortfuypixnb
npx supabase functions deploy notify
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
the platform — do **not** add them to `.env`, and never let the service role
key near the app bundle. It bypasses RLS.

## 4. Point the webhooks at it

Dashboard → Database → Webhooks → "Create a new hook", twice:

| Table         | Events | Type            | Target            |
| ------------- | ------ | --------------- | ----------------- |
| `friendships` | Insert | Supabase Edge Function | `notify`   |
| `rank_events` | Insert | Supabase Edge Function | `notify`   |

That's the whole wiring: a row appears, the webhook fires, the function looks
up who should hear about it and posts to Expo's push service.

## 5. Test it

Build a dev/preview APK, open the app, and let it ask for notification
permission (it asks when you open Friends, not on first launch — a prompt
with no context gets denied forever). Then from another account send yourself
a friend request.

To check the token landed:

```sql
select user_id, platform, created_at from public.push_tokens;
```

## Notes

- Tokens are per DEVICE, keyed on the token itself, so re-registering
  updates rather than duplicating. Signing out deletes this device's row —
  otherwise the next person to use the phone gets the previous owner's
  notifications.
- The function batches to Expo's 100-messages-per-request limit.
- Expo's push receipts are not checked yet. If delivery ever looks flaky,
  that's the next thing to add: the send response contains ticket ids you
  can query for per-message errors (including `DeviceNotRegistered`, which
  is the signal to delete a stale token).
