/** Profile tab — stats summary, settings, and Supabase account/sync. */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Card, PrimaryButton, SectionTitle, TextField, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { workoutVolume, type Unit } from "../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4, alignItems: "center" }}>
      <Txt size={20} weight="extrabold">{value}</Txt>
      <Txt size={11} weight="bold" color={C.inkFaint}>{label}</Txt>
    </Card>
  );
}

function Account() {
  const { enabled, user, signIn, signUp, signOut } = useAuth();
  const { syncNow } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <Card>
        <Txt size={13} color={C.inkFaint}>
          Cloud sync is off. Add EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env to enable it — the app
          works fully offline without them.
        </Txt>
      </Card>
    );
  }

  if (user) {
    return (
      <Card style={{ gap: 10 }}>
        <Txt size={13} weight="semibold">Signed in as {user.email}</Txt>
        <PrimaryButton label="Sync now" onPress={() => void syncNow()} />
        <PrimaryButton label="Sign out" background={C.page2} color={C.ink} onPress={() => void signOut()} />
      </Card>
    );
  }

  const go = async (fn: typeof signIn) => {
    setBusy(true);
    setError(null);
    const { error } = await fn(email, password);
    setError(error);
    setBusy(false);
  };

  return (
    <Card style={{ gap: 10 }}>
      <TextField value={email} onChange={setEmail} placeholder="Email" />
      <TextField value={password} onChange={setPassword} placeholder="Password" />
      {error ? (
        <Txt size={12} weight="semibold" color={C.badAcc}>{error}</Txt>
      ) : null}
      <PrimaryButton label="Sign in" onPress={() => void go(signIn)} disabled={busy} />
      <PrimaryButton
        label="Create account"
        background={C.page2}
        color={C.ink}
        onPress={() => void go(signUp)}
        disabled={busy}
      />
    </Card>
  );
}

export function Profile() {
  const { workouts, settings, updateSettings } = useStore();
  const totalVolume = workouts.reduce((s, w) => s + workoutVolume(w), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <Txt size={22} weight="extrabold">Profile</Txt>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="WORKOUTS" value={String(workouts.length)} />
        <Stat label={`VOLUME (${settings.unit.toUpperCase()})`} value={String(Math.round(totalVolume))} />
      </View>

      <SectionTitle>Settings</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt size={12} weight="bold" color={C.inkSoft}>Your name</Txt>
        <TextField
          value={settings.name}
          onChange={(name) => updateSettings({ name })}
          placeholder="Name"
        />
        <Txt size={12} weight="bold" color={C.inkSoft}>Units</Txt>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["kg", "lb"] as Unit[]).map((u) => (
            <Pressable
              key={u}
              onPress={() => updateSettings({ unit: u })}
              style={{
                backgroundColor: settings.unit === u ? C.primary : C.page2,
                borderRadius: R.pill,
                paddingHorizontal: 16,
                paddingVertical: 6,
              }}
            >
              <Txt size={13} weight="bold" color={settings.unit === u ? "#fff" : C.inkSoft}>
                {u}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Card>

      <SectionTitle>Account & sync</SectionTitle>
      <Account />
    </ScrollView>
  );
}
