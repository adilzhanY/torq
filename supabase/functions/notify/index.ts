/**
 * Supabase Edge Function: send a push when a friend request arrives or a
 * friend ranks up.
 *
 * Invoked by a Database Webhook (see supabase/functions/notify/README.md),
 * so it receives Supabase's standard webhook envelope for an INSERT.
 *
 * Why a server function at all: the interesting events happen to OTHER
 * people. A phone that is closed cannot notice that someone added you, so
 * the device can never be the thing that decides to notify.
 *
 * Runs on Deno. It uses the SERVICE ROLE key, which bypasses RLS. That is
 * required to read the recipient's push tokens (their RLS policy correctly
 * forbids everyone else from reading them) and is exactly why this code must
 * live server-side and never ship in the app.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

interface Message {
  to: string;
  title: string;
  body: string;
  data: { kind: string };
  channelId: string;
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/** Display name for a user, falling back to their handle. */
async function nameOf(userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("handle, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.display_name || (data?.handle ? `@${data.handle}` : "Someone");
}

async function tokensFor(userId: string): Promise<string[]> {
  const { data } = await admin.from("push_tokens").select("token").eq("user_id", userId);
  return (data ?? []).map((r: { token: string }) => r.token);
}

/** Everyone who has accepted a friendship with this user. */
async function friendsOf(userId: string): Promise<string[]> {
  const { data } = await admin
    .from("friendships")
    .select("requester, addressee")
    .eq("status", "accepted")
    .or(`requester.eq.${userId},addressee.eq.${userId}`);
  return (data ?? []).map((r: { requester: string; addressee: string }) =>
    r.requester === userId ? r.addressee : r.requester,
  );
}

async function send(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

Deno.serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return new Response("ignored", { status: 200 });
  }

  const messages: Message[] = [];

  // ── a friend request landed ────────────────────────────────────────────
  if (payload.table === "friendships" && payload.record.status === "pending") {
    const requester = String(payload.record.requester);
    const addressee = String(payload.record.addressee);
    const who = await nameOf(requester);
    for (const to of await tokensFor(addressee)) {
      messages.push({
        to,
        title: "New friend request",
        body: `${who} wants to compare ranks with you.`,
        data: { kind: "friend_request" },
        channelId: "default",
      });
    }
  }

  // ── a friend ranked up ─────────────────────────────────────────────────
  // rank_events only ever holds promotions (the device filters demotions),
  // so anything here is worth celebrating.
  if (payload.table === "rank_events") {
    const userId = String(payload.record.user_id);
    const who = await nameOf(userId);
    const tier = String(payload.record.to_tier);
    const lift = payload.record.lift_name ? String(payload.record.lift_name) : null;
    const friends = await friendsOf(userId);
    for (const friend of friends) {
      for (const to of await tokensFor(friend)) {
        messages.push({
          to,
          title: `${who} reached ${tier}`,
          body: lift ? `On ${lift}. Your move.` : "Overall rank up. Your move.",
          data: { kind: "rank_up" },
          channelId: "default",
        });
      }
    }
  }

  await send(messages);
  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
