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
import { AuthProvider } from "./src/lib/auth";
import { StoreProvider, useStore } from "./src/lib/store";
import { UiProvider, useUi } from "./src/lib/ui";
import { C } from "./src/theme";
import { Logo, LOGO_BG, LOGO_FG } from "./src/components/Logo";
import { BottomNav } from "./src/components/BottomNav";
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
  const [profileOpen, setProfileOpen] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: C.page }}>
        <Logo size={96} />
        <ActivityIndicator color={C.accent} />
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
