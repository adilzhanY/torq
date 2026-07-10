/** Profile — stats summary, settings, and Supabase account/sync. No longer a
 * tab: opens as a full-screen overlay from the avatar button in the top bar. */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { SlideUp } from "../components/anim";
import { Card, NumberField, PrimaryButton, SectionTitle, TextField, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { LB_TO_KG, cmToFtIn, ftInToCm } from "../lib/units";
import { workoutVolume, type Settings, type Unit } from "../types";

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

/** Sex / birth year / height / fallback weight — feeds calorie estimation. */
function BodyProfileCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}) {
  const isLb = settings.unit === "lb";
  const [birthYear, setBirthYear] = useState(settings.birthYear ? String(settings.birthYear) : "");
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : "");
  const savedFtIn = settings.heightCm ? cmToFtIn(settings.heightCm) : null;
  const [heightFt, setHeightFt] = useState(savedFtIn ? String(savedFtIn.ft) : "");
  const [heightIn, setHeightIn] = useState(savedFtIn ? String(savedFtIn.inch) : "");
  const [weight, setWeight] = useState(
    settings.weightKg
      ? String(Math.round(isLb ? settings.weightKg / LB_TO_KG : settings.weightKg))
      : "",
  );

  const commitNumber = (raw: string, save: (n: number | undefined) => void) => {
    const n = Number(raw);
    save(n > 0 ? n : undefined);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Txt size={12} weight="bold" color={C.inkSoft}>Sex</Txt>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["male", "female"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => updateSettings({ sex: s })}
            style={{
              backgroundColor: settings.sex === s ? C.primary : C.page2,
              borderRadius: R.pill,
              paddingHorizontal: 16,
              paddingVertical: 6,
            }}
          >
            <Txt size={13} weight="bold" color={settings.sex === s ? "#fff" : C.inkSoft}>
              {s === "male" ? "Male" : "Female"}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Birth year"
            value={birthYear}
            onChange={setBirthYear}
            placeholder="2000"
            onBlur={() => commitNumber(birthYear, (n) => updateSettings({ birthYear: n }))}
          />
        </View>
        {isLb ? (
          <>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Height"
                value={heightFt}
                onChange={setHeightFt}
                suffix="ft"
                placeholder="5"
                onBlur={() => {
                  const cm = ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0);
                  updateSettings({ heightCm: cm > 0 ? cm : undefined });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label=" "
                value={heightIn}
                onChange={setHeightIn}
                suffix="in"
                placeholder="9"
                onBlur={() => {
                  const cm = ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0);
                  updateSettings({ heightCm: cm > 0 ? cm : undefined });
                }}
              />
            </View>
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <NumberField
              label="Height"
              value={height}
              onChange={setHeight}
              suffix="cm"
              placeholder="175"
              onBlur={() => commitNumber(height, (n) => updateSettings({ heightCm: n }))}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <NumberField
            label="Weight"
            value={weight}
            onChange={setWeight}
            suffix={settings.unit}
            placeholder={isLb ? "165" : "75"}
            onBlur={() =>
              commitNumber(weight, (n) =>
                updateSettings({ weightKg: n == null ? undefined : isLb ? n * LB_TO_KG : n }),
              )
            }
          />
        </View>
      </View>
      <Txt size={11} color={C.inkFaint}>
        Used to estimate calories burnt. Weight prefers your latest “Body
        weight” entry on the Measure tab; this one is the fallback.
      </Txt>
    </Card>
  );
}

/** Daily goals for the Home dashboard (defaults in lib/stats dailyGoals). */
function DailyGoalsCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}) {
  const [kcal, setKcal] = useState(settings.kcalGoal ? String(settings.kcalGoal) : "");
  const [min, setMin] = useState(settings.activeMinGoal ? String(settings.activeMinGoal) : "");
  const [sets, setSets] = useState(settings.setsGoal ? String(settings.setsGoal) : "");
  const [volume, setVolume] = useState(settings.volumeGoal ? String(settings.volumeGoal) : "");

  const commit = (raw: string, save: (n: number | undefined) => void) => {
    const n = Number(raw);
    save(n > 0 ? Math.round(n) : undefined);
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Calories"
            value={kcal}
            onChange={setKcal}
            suffix="kcal"
            placeholder="300"
            onBlur={() => commit(kcal, (n) => updateSettings({ kcalGoal: n }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Active time"
            value={min}
            onChange={setMin}
            suffix="min"
            placeholder="60"
            onBlur={() => commit(min, (n) => updateSettings({ activeMinGoal: n }))}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Sets"
            value={sets}
            onChange={setSets}
            placeholder="25"
            onBlur={() => commit(sets, (n) => updateSettings({ setsGoal: n }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Volume"
            value={volume}
            onChange={setVolume}
            suffix={settings.unit}
            placeholder="8000"
            onBlur={() => commit(volume, (n) => updateSettings({ volumeGoal: n }))}
          />
        </View>
      </View>
      <Txt size={11} color={C.inkFaint}>
        Per-day targets for the Home dashboard bar and gauges.
      </Txt>
    </Card>
  );
}

const GOAL_LABEL: Record<string, string> = {
  muscle: "Build muscle",
  lean: "Get lean",
  strength: "Get strong",
  fit: "Stay fit",
};

export function Profile({
  onClose,
  onRebuildPlan,
}: {
  onClose: () => void;
  /** Reopens the onboarding wizard to regenerate the training plan. */
  onRebuildPlan: () => void;
}) {
  const { workouts, settings, updateSettings } = useStore();
  const totalVolume = workouts.reduce((s, w) => s + workoutVolume(w), 0);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable hitSlop={8} onPress={onClose}>
          <Icon name="ChevronLeft" size={24} color={C.ink} />
        </Pressable>
        <Txt size={22} weight="extrabold" style={{ flex: 1 }}>Profile</Txt>
      </View>

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

      <SectionTitle>Body profile</SectionTitle>
      <BodyProfileCard settings={settings} updateSettings={updateSettings} />

      <SectionTitle>Training plan</SectionTitle>
      <Card style={{ gap: 10 }}>
        {settings.plan ? (
          <Txt size={13} weight="semibold">
            {GOAL_LABEL[settings.plan.goal] ?? settings.plan.goal} ·{" "}
            {settings.plan.weekdays?.length ?? 0} days a week
            {settings.plan.focus.length
              ? ` · focus: ${settings.plan.focus.join(", ")}`
              : ""}
          </Txt>
        ) : (
          <Txt size={13} color={C.inkFaint}>
            No plan yet — answer a few questions and Torq builds your week.
          </Txt>
        )}
        <PrimaryButton
          label={settings.plan ? "Rebuild plan" : "Build my plan"}
          onPress={onRebuildPlan}
        />
      </Card>

      <SectionTitle>Daily goals</SectionTitle>
      <DailyGoalsCard settings={settings} updateSettings={updateSettings} />

      <SectionTitle>Account & sync</SectionTitle>
      <Account />
    </ScrollView>
    </SlideUp>
  );
}
