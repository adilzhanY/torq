/**
 * Avatar: the round profile picture, with the lime initial as the fallback.
 *
 * The fallback is not just for "no picture yet": a stored URI can go stale
 * (a local file the OS cleaned up, a remote URL that 404s after an account
 * is deleted), and an avatar that renders as an empty hole looks broken.
 * `onError` flips back to the initial, so the worst case is the same as the
 * no-picture case.
 */
import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { C } from "../theme";
import { Txt } from "./ui";

export function Avatar({
  uri,
  name,
  size = 44,
  style,
}: {
  /** Local file:// path or a remote URL. Empty/undefined → initial. */
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  // A new picture must repaint even if the previous one failed.
  useEffect(() => setFailed(false), [uri]);

  const initial = (name?.trim() || "A")[0].toUpperCase();
  const show = uri && !failed;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: show ? C.page2 : C.accent,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {show ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <Txt size={size * 0.42} weight="extrabold" color={C.accentInk}>
          {initial}
        </Txt>
      )}
    </View>
  );
}
