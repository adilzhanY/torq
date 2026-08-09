/**
 * Push notifications for friend requests and rank-ups.
 *
 * ⚠️ THE IMPORT ITSELF IS THE DANGEROUS PART — do not turn the dynamic
 * import below back into a top-level `import * as Notifications from
 * "expo-notifications"`.
 *
 * `expo-notifications/build/index.js` re-exports
 * `DevicePushTokenAutoRegistration.fx`, and that module calls
 * `addPushTokenListener()` at MODULE SCOPE. In Expo Go on Android that
 * helper THROWS (remote push was removed from Expo Go in SDK 53). A throw
 * while a module is being required takes the whole bundle down, so the app
 * never rendered a frame in Expo Go: a red "[runtime not ready]" box before
 * any of our code ran. Guarding our own functions with `pushSupported()` did
 * nothing, because the crash happened at import time, before any function
 * could be called. Caught on the emulator 2026-08-09.
 *
 * So the module is loaded LAZILY and only once we know we are not in Expo
 * Go. Everything degrades to a silent no-op there, which keeps
 * `run_android.sh` working — it just cannot deliver a push, which was
 * already true.
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
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/** Type-only: `typeof import(...)` is erased, so this pulls in no code. */
type NotificationsApi = typeof import("expo-notifications");

let cached: NotificationsApi | null = null;

/** Expo Go can't do remote push (SDK 53+); everything degrades quietly. */
export function pushSupported(): boolean {
  return !isRunningInExpoGo();
}

/**
 * The one place expo-notifications is loaded. Returns null in Expo Go, where
 * importing it would throw and kill the bundle.
 */
async function notifications(): Promise<NotificationsApi | null> {
  if (!pushSupported()) return null;
  if (cached) return cached;
  try {
    const mod = await import("expo-notifications");
    // Show a banner even when the app is open — these are always
    // user-relevant. Set here rather than at module scope because there is
    // no module scope to set it in any more.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    cached = mod;
    return cached;
  } catch {
    // A build where the native module is missing must not break the app.
    return null;
  }
}

/**
 * Warm the module up so the foreground notification handler is installed
 * before anything can arrive. A no-op in Expo Go. Safe to call at startup —
 * it never throws and never blocks the first frame.
 */
export function primePush(): void {
  void notifications();
}

/** The EAS project id, which getExpoPushTokenAsync requires. */
function easProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  // easConfig is the documented fallback but is not in the public types.
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  return (fromConfig as string | undefined) ?? fromEas;
}

async function ensureAndroidChannel(n: NotificationsApi): Promise<void> {
  if (Platform.OS !== "android") return;
  // Android 13+ shows no permission prompt until a channel exists, and
  // getExpoPushTokenAsync needs the channel first.
  await n.setNotificationChannelAsync("default", {
    name: "torq",
    importance: n.AndroidImportance.DEFAULT,
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
  const n = await notifications();
  if (!n) return "unsupported";
  try {
    await ensureAndroidChannel(n);

    const existing = await n.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await n.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return "denied";

    const projectId = easProjectId();
    if (!projectId) return "unsupported";

    const token = (await n.getExpoPushTokenAsync({ projectId })).data;
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
  const n = await notifications();
  if (!n) return;
  try {
    const projectId = easProjectId();
    if (!projectId) return;
    const token = (await n.getExpoPushTokenAsync({ projectId })).data;
    const sb = supabase();
    if (!sb) return;
    await sb.from("push_tokens").delete().eq("token", token);
  } catch {
    // Nothing actionable.
  }
}

export type PushTap = { kind: "friend_request" | "rank_up" | "unknown" };

/**
 * Listen for taps on a notification. Returns an unsubscribe function
 * SYNCHRONOUSLY, so callers can use it straight from a useEffect even though
 * the module underneath resolves a tick later. The caller decides where to
 * navigate — this module knows nothing about screens.
 */
export function onNotificationTap(handler: (tap: PushTap) => void): () => void {
  let sub: { remove: () => void } | null = null;
  let cancelled = false;

  void notifications().then((n) => {
    if (!n || cancelled) return;
    sub = n.addNotificationResponseReceivedListener((response) => {
      const kind = response.notification.request.content.data?.kind;
      handler({
        kind: kind === "friend_request" || kind === "rank_up" ? kind : "unknown",
      });
    });
  });

  return () => {
    cancelled = true;
    sub?.remove();
    sub = null;
  };
}
