import "./src/global.css";
import { ActivityIndicator, View } from "react-native";
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
import { C } from "./src/theme";
import { Logo } from "./src/components/Logo";
import { BottomNav } from "./src/components/BottomNav";
import { Txt } from "./src/components/ui";
import { Workout } from "./src/screens/Workout";
import { History } from "./src/screens/History";
import { Exercises } from "./src/screens/Exercises";
import { Measure } from "./src/screens/Measure";
import { Profile } from "./src/screens/Profile";

function Root() {
  const { tab } = useUi();
  const { ready, settings } = useStore();
  const name = settings.name?.trim();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: C.page }}>
        <Logo size={96} color={C.primary} />
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      {/* Top bar: logo + greeting */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 4,
        }}
      >
        <Logo size={26} color={C.primary} />
        <Txt size={16} weight="extrabold">
          {name ? `Hello, ${name}.` : "Torq"}
        </Txt>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "workout" && <Workout />}
        {tab === "history" && <History />}
        {tab === "exercises" && <Exercises />}
        {tab === "measure" && <Measure />}
        {tab === "profile" && <Profile />}
      </View>

      <BottomNav />
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.primary }}>
        <ActivityIndicator color="#fff" />
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
