/**
 * SubPage: the frame every "row that opens a page" uses: a slide-up sheet
 * with a back header, its own hardware-back handler, and a keyboard-aware
 * scroll body.
 *
 * It exists because this app has no router: a sub-page is one piece of state
 * in the parent plus this frame, and that has stayed simpler than adding
 * navigation would have been. Shared by Settings (body profile, goals,
 * account, data, developer) and Stats (measurements, training load), so the
 * back gesture behaves identically everywhere.
 */
import { useEffect } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "./KeyboardAware";
import { C } from "../theme";
import { Icon } from "./Icon";
import { SlideUp } from "./anim";
import { PageTitle, Txt } from "./ui";

export function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  // The most recently mounted handler answers first, so a sub-page always
  // wins over the screen underneath it.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <SlideUp
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.page,
      }}
    >
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onBack}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <PageTitle style={{ flex: 1 }}>{title}</PageTitle>
        </View>
        {children}
      </KeyboardAwareScrollView>
    </SlideUp>
  );
}
