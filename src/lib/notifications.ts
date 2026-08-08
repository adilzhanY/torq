/**
 * Push notifications for friend requests and rank-ups.
 *
 * IMPORTANT (SDK 57 docs): remote push does NOT work in Expo Go on Android
 * from SDK 53 — it needs a development or preview build. Everything here is
 * written to no-op safely in Expo Go rather than throw, so the emulator dev
 * loop keeps working; local notifications still function there.
 *
 * What this module does NOT do: decide when to notify. That belongs on the
 * server (see supabase/functions/notify), because a device that is closed
 * cannot notice that someone added them — which is the entire point.
 *
 * Consent: the OS prompt only appears once, so we ask at a moment where the
 * request makes sense (after the user engages with the social features),
 * not on first launch when it reads as noise and gets denied forever.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/** Show a banner even when the app is open — these are always user-relevant. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Expo Go can't do remote push (SDK 53+); everything degrades quietly. */
export function pushSupported(): boolean {
  return Constants.appOwnership !== "expo";
}

/** The EAS project id, which getExpoPushTokenAsync requires. */
function easProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  // easConfig is the documented fallback but is not in the public types.
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  return (fromConfig as string | undefined) ?? fromEas;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Android 13+ shows no permission prompt until a channel exists, and
  // getExpoPushTokenAsync needs the channel first.
  await Notifications.setNotificationChannelAsync("default", {
    name: "torq",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#C8FE23",
  });
}

export type PermissionOutcome = "granted" | "denied" | "unsupported";

/**
 * Ask for permission and register this device's token against the signed-in
 * user. Safe to call repeatedly: the OS returns the existing decision and
 * the token upsert is idempotent.
 */
export async function registerForPush(): Promise<PermissionOutcome> {
  if (!pushSupported()) return "unsupported";
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return "denied";

    const projectId = easProjectId();
    if (!projectId) return "unsupported";

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await saveToken(token);
    return "granted";
  } catch {
    // A push failure must never break the screen that asked.
    return "unsupported";
  }
}

/** Store the token so the server can reach this device. */
async function saveToken(token: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb.from("push_tokens").upsert(
    { user_id: auth.user.id, token, platform: Platform.OS },
    { onConflict: "token" },
  );
}

/**
 * Drop this device's token. Called on sign-out: leaving it behind would send
 * the next person's friend requests to the previous owner's phone.
 */
export async function unregisterPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const projectId = easProjectId();
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const sb = supabase();
    if (!sb) return;
    await sb.from("push_tokens").delete().eq("token", token);
  } catch {
    // Nothing actionable.
  }
}

export type PushTap = { kind: "friend_request" | "rank_up" | "unknown" };

/**
 * Listen for taps on a notification. Returns an unsubscribe function.
 * The caller decides where to navigate — this module knows nothing about
 * screens.
 */
export function onNotificationTap(handler: (tap: PushTap) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const kind = response.notification.request.content.data?.kind;
    handler({
      kind: kind === "friend_request" || kind === "rank_up" ? kind : "unknown",
    });
  });
  return () => sub.remove();
}
