import "./src/global.css";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { StoreProvider, useStore } from "./src/lib/store";
import { UiProvider, useUi } from "./src/lib/ui";
import { C } from "./src/theme";
import { Logo, SpinningLogo, LOGO_BG, LOGO_FG } from "./src/components/Logo";
import { BottomNav } from "./src/components/BottomNav";
import { Auth } from "./src/screens/Auth";
import { Home } from "./src/screens/Home";
import { Ranks } from "./src/screens/Ranks";
import { Onboarding } from "./src/screens/Onboarding";
import { Workout } from "./src/screens/Workout";
import { History } from "./src/screens/History";
import { Exercises } from "./src/screens/Exercises";
import { Stats } from "./src/screens/Stats";
import { Profile } from "./src/screens/Profile";

function Root() {
  const { tab, planWizard, openPlanWizard, closePlanWizard } = useUi();
  const { ready, settings } = useStore();
  const auth = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  // Restoring the session and reading the local DB both gate the first
  // frame — one splash covers both so the app never flashes the auth screen
  // at someone who is already signed in.
  if (!ready || (auth.enabled && auth.loading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: C.page }}>
        <SpinningLogo size={96} period={2.2} />
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  // The gate: only when cloud sync is actually configured, and never for a
  // user who chose to stay local.
  if (auth.enabled && !auth.user && !auth.guest) {
    return <Auth />;
  }

  if (!settings.onboarded || planWizard) {
    return <Onboarding onDone={closePlanWizard} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <View style={{ flex: 1 }}>
        {tab === "home" && <Home />}
        {tab === "ranks" && <Ranks />}
        {tab === "workout" && <Workout />}
        {tab === "history" && <History />}
        {tab === "exercises" && <Exercises />}
        {tab === "stats" && <Stats />}
      </View>

      <BottomNav onProfile={() => setProfileOpen(true)} />

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
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
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
            <StatusBar style="light" />
          </UiProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
