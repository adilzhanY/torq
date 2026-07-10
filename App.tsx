import "./src/global.css";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  useFonts,
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  Onest_800ExtraBold,
} from "@expo-google-fonts/onest";
import { AuthProvider } from "./src/lib/auth";
import { StoreProvider, useStore } from "./src/lib/store";
import { UiProvider, useUi } from "./src/lib/ui";
import { C, clay } from "./src/theme";
import { Logo, LOGO_BG, LOGO_FG } from "./src/components/Logo";
import { BottomNav } from "./src/components/BottomNav";
import { Icon } from "./src/components/Icon";
import { Txt } from "./src/components/ui";
import { Home } from "./src/screens/Home";
import { Onboarding } from "./src/screens/Onboarding";
import { Workout } from "./src/screens/Workout";
import { History } from "./src/screens/History";
import { Exercises } from "./src/screens/Exercises";
import { Stats } from "./src/screens/Stats";
import { Profile } from "./src/screens/Profile";

function Root() {
  const { tab, planWizard, openPlanWizard, closePlanWizard } = useUi();
  const { ready, settings } = useStore();
  const name = settings.name?.trim();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: C.page }}>
        <Logo size={96} />
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (!settings.onboarded || planWizard) {
    return <Onboarding onDone={closePlanWizard} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <View style={{ flex: 1 }}>
        {tab === "home" && <Home />}
        {tab === "workout" && <Workout />}
        {tab === "history" && <History />}
        {tab === "exercises" && <Exercises />}
        {tab === "stats" && <Stats />}
      </View>

      {/* Floating top bar — the dock pill's light twin: logo left, greeting
          centered, profile right. Content scrolls under it (screens pad
          TOP_BAR_SPACE); rendered before overlays like Profile so they
          cover it. */}
      <View
        style={[
          {
            position: "absolute",
            top: 8,
            left: 14,
            right: 14,
            height: 52,
            borderRadius: 999,
            backgroundColor: C.surface,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
          },
          clay(),
        ]}
      >
        <Logo size={26} />
        <Txt
          size={15}
          weight="extrabold"
          style={{ flex: 1, textAlign: "center" }}
          numberOfLines={1}
        >
          {name ? `Hello, ${name}.` : "Torq"}
        </Txt>
        <Pressable hitSlop={8} onPress={() => setProfileOpen(true)}>
          <Icon name="UserCircle" size={26} color={C.ink} />
        </Pressable>
      </View>

      <BottomNav />

      {profileOpen ? (
        <Profile
          onClose={() => setProfileOpen(false)}
          onRebuildPlan={() => {
            setProfileOpen(false);
            openPlanWizard();
          }}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Onest_800ExtraBold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: LOGO_BG }}>
        <ActivityIndicator color={LOGO_FG} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StoreProvider>
          <UiProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: C.page }} edges={["top"]}>
              <Root />
            </SafeAreaView>
            <StatusBar style="dark" />
          </UiProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
