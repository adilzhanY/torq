import "./src/global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
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
import { primePush } from "./src/lib/notifications";
import { StoreProvider, useStore } from "./src/lib/store";
import { UiProvider, useUi } from "./src/lib/ui";
import { C } from "./src/theme";
import { Logo, SpinningLogo, LOGO_BG, LOGO_FG } from "./src/components/Logo";
import { BottomNav } from "./src/components/BottomNav";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { Icon } from "./src/components/Icon";
import { Txt } from "./src/components/ui";
import { ConfirmModal } from "./src/components/CustomModal";
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
  const { ready, settings, loadError } = useStore();
  const auth = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [configNoteOpen, setConfigNoteOpen] = useState(false);
  const [dataNoteOpen, setDataNoteOpen] = useState(false);

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
        {/* Per-TAB boundary, not one around the whole app: if Stats throws,
            the dock survives and the user can walk to another tab instead of
            force-quitting. Keyed by tab so switching away clears the error. */}
        <ErrorBoundary key={tab}>
          {tab === "home" && <Home />}
          {tab === "ranks" && <Ranks />}
          {tab === "workout" && <Workout />}
          {tab === "history" && <History />}
          {tab === "exercises" && <Exercises />}
          {tab === "stats" && <Stats />}
        </ErrorBoundary>
      </View>

      {/* Data that could not be read is the most serious thing this app can
          report: the app is running on an empty database, and the damaged
          blob is parked under db.ts's BACKUP_KEY. Say so before the user
          logs a session on top of it. */}
      {loadError ? (
        <Pressable
          onPress={() => setDataNoteOpen(true)}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 8,
            zIndex: 60,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: C.badSurf,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Icon name="TriangleAlert" size={14} color={C.badAcc} />
          <Txt size={11} weight="bold" color={C.badAcc} style={{ flex: 1 }}>
            Saved data could not be read — tap before logging anything
          </Txt>
        </Pressable>
      ) : null}

      {dataNoteOpen ? (
        <ConfirmModal
          title="Your saved data could not be read"
          message={
            "torq is running on an empty database right now. The unreadable " +
            "copy has been kept on this device, so nothing has been deleted " +
            "— but logging new workouts will save over it. If you have an " +
            "account, sign in first and your data will come back from the " +
            "cloud."
          }
          confirmLabel="Understood"
          onConfirm={() => setDataNoteOpen(false)}
          onClose={() => setDataNoteOpen(false)}
        />
      ) : null}

      {/* Loud failure instead of a silent one. When the Supabase env vars
          are missing the auth gate quietly skips itself and accounts look
          "broken" with no explanation — which is exactly what happened to
          the first EAS build, whose profile had no env block (.env is
          gitignored, so EAS never uploads it). If this banner is visible in
          a real build, fix eas.json, not the app. */}
      {!auth.enabled ? (
        <Pressable
          onPress={() => setConfigNoteOpen(true)}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 8,
            zIndex: 50,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: C.warnSurf,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Icon name="TriangleAlert" size={14} color={C.warnAcc} />
          <Txt size={11} weight="bold" color={C.warnAcc} style={{ flex: 1 }}>
            Cloud sync not configured — accounts and friends are off
          </Txt>
        </Pressable>
      ) : null}

      <BottomNav onProfile={() => setProfileOpen(true)} />

      {configNoteOpen ? (
        <ConfirmModal
          title="Cloud sync is not configured"
          message={
            "This build shipped without EXPO_PUBLIC_SUPABASE_URL / " +
            "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, so sign-in, friends and " +
            "backup are disabled. Everything else works offline. Fix: add " +
            "them to the build profile's env in eas.json (.env is gitignored, " +
            "so EAS never uploads it) and rebuild."
          }
          confirmLabel="Got it"
          onConfirm={() => setConfigNoteOpen(false)}
          onClose={() => setConfigNoteOpen(false)}
        />
      ) : null}

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
  // Loads expo-notifications and installs the foreground handler in real
  // builds; a deliberate no-op in Expo Go, where importing that package at
  // all throws and would take the whole bundle down (see lib/notifications).
  useEffect(primePush, []);

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
            {/* Reserve BOTH system bars. The Android navigation bar (the
                back/home/recents strip) was drawing over the app: the dock
                compensated for it but nothing else did, so every
                bottom-anchored control — the rest-timer pad, the picker's
                "Add N exercises" footer, the new-exercise sheet — sat
                underneath it and could not be tapped. Reserving the inset
                once here means no child can draw under the bar, and every
                hardcoded paddingBottom in the app stays correct. */}
            <SafeAreaView style={{ flex: 1, backgroundColor: C.page }} edges={["top", "bottom"]}>
              {/* Outer net: onboarding, the auth gate and the providers
                  themselves are outside any tab boundary. */}
              <ErrorBoundary>
                <Root />
              </ErrorBoundary>
            </SafeAreaView>
            <StatusBar style="light" />
          </UiProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
