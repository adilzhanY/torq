/**
 * Profile picture: pick it, keep it, and (when there is an account) publish
 * it so friends see a face instead of a letter.
 *
 * Two storage locations on purpose, because torq is local-first:
 *  - the PHONE always gets the picture, copied out of the picker's cache
 *    into the document directory (`Settings.avatarUri`). A guest with no
 *    account still has an avatar, and it survives the OS clearing caches.
 *  - the SERVER copy (`Settings.avatarUrl` + `profiles.avatar_url`) only
 *    exists when signed in. It is what other devices and friends read, so
 *    the display order is avatarUrl → avatarUri → initial.
 *
 * Filenames carry a timestamp rather than being overwritten in place:
 * expo-image caches by URI, so reusing one path would keep showing the old
 * picture. The remote URL gets the same treatment via a `?v=` query.
 */
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import { supabase } from "./supabase";

const PREFIX = "avatar-";
const BUCKET = "avatars";

/** Where the server copy lives: one object per user, folder-scoped by RLS. */
function objectPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

/** Drop every previously kept avatar; the newest one is the only one we need. */
function clearStored(dir: Directory): void {
  for (const item of dir.list()) {
    if (item.name.startsWith(PREFIX)) {
      try {
        item.delete();
      } catch {
        // A leftover file is harmless. Never fail a pick over cleanup.
      }
    }
  }
}

/**
 * Open the system picker and keep the chosen square. Returns a null uri with
 * a null error when the user simply cancelled. That is not a failure.
 */
export async function pickAvatar(): Promise<{ uri: string | null; error: string | null }> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return {
        uri: null,
        error: "Photo access is off. Allow it in system settings to pick a picture.",
      };
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return { uri: null, error: null };

    clearStored(Paths.document);
    const dest = new File(Paths.document, `${PREFIX}${Date.now()}.jpg`);
    new File(res.assets[0].uri).copy(dest);
    return { uri: dest.uri, error: null };
  } catch (e) {
    return { uri: null, error: e instanceof Error ? e.message : "Could not open your photos." };
  }
}

/**
 * Push the local picture to Supabase Storage and point the public profile at
 * it. Signed out is not an error the user needs shouting at them (the
 * picture still works on this phone), so the caller decides what to show.
 */
export async function uploadAvatar(localUri: string): Promise<{ url: string | null; error: string | null }> {
  const sb = supabase();
  if (!sb) return { url: null, error: null };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { url: null, error: null };

  try {
    const bytes = await new File(localUri).arrayBuffer();
    const path = objectPath(auth.user.id);
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) return { url: null, error: error.message };

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    // The object path never changes, so without a version the CDN (and every
    // friend's image cache) would keep serving the previous picture.
    const url = `${data.publicUrl}?v=${Date.now()}`;
    // Only an update: a user who has not claimed a handle has no profile row,
    // and inventing one here would break the handle opt-in.
    await sb.from("profiles").update({ avatar_url: url }).eq("user_id", auth.user.id);
    return { url, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

/** Remove both copies. Failures on the server side are not worth blocking on. */
export async function removeAvatar(): Promise<void> {
  clearStored(Paths.document);
  const sb = supabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb.storage.from(BUCKET).remove([objectPath(auth.user.id)]).catch(() => {});
  await sb.from("profiles").update({ avatar_url: null }).eq("user_id", auth.user.id);
}

/** What to render: the server copy wins, since it is valid on every device. */
export function avatarSource(s: { avatarUrl?: string; avatarUri?: string }): string | undefined {
  return s.avatarUrl || s.avatarUri || undefined;
}
