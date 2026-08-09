/**
 * Settings — the grouped hub (idea 2 of the lavish profile review,
 * `.lavish/torq-profile.html`, 2026-08-09). Everything adjustable moved off
 * Profile and landed here.
 *
 * The rule that shapes it: **every row shows its current value**. "What unit
 * am I on" is answered by scanning the list, not by opening a page. Rows
 * whose control is a single switch keep it inline; anything with more than
 * one field gets a focused sub-page, so no screen is ever a wall again.
 *
 * Sub-pages are plain state, not a router — this app has no router, and one
 * `sub` key plus a shared frame is the whole mechanism.
 */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "../components/KeyboardAware";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { SlideUp } from "../components/anim";
import { SubPage } from "../components/SubPage";
import { ConfirmDialog } from "../components/Dialog";
import { Divider, Eyebrow, NumberField, PrimaryButton, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { deleteAccount } from "../lib/social";
import { isPro, setPro } from "../lib/entitlements";
import { LB_TO_KG, cmToFtIn, ftInToCm } from "../lib/units";
import type { Settings as SettingsModel, Unit } from "../types";

type Sub = "body" | "goals" | "account" | "data" | "dev" | null;

const GOAL_LABEL: Record<string, string> = {
  muscle: "Build muscle",
  lean: "Get lean",
  strength: "Get strong",
  fit: "Stay fit",
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One tappable row: icon tile, title, the CURRENT VALUE, chevron. */
function Row({
  icon,
  title,
  value,
  onPress,
  tone,
  right,
}: {
  icon?: string;
  title: string;
  value?: string;
  onPress?: () => void;
  /** Destructive rows colour their title and tile border. */
  tone?: string;
  /** Inline control (a toggle, a pair of chips) instead of a chevron. */
  right?: React.ReactNode;
}) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 }}>
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: R.ctrl,
            backgroundColor: C.page2,
            borderWidth: 1,
            borderColor: tone ? `${tone}66` : C.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={17} color={tone ?? C.ink} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt size={14} weight="semibold" color={tone ?? C.ink}>{title}</Txt>
        {value ? (
          <Txt size={11.5} color={C.inkFaint} numberOfLines={1}>{value}</Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="ChevronRight" size={17} color={C.inkFaint} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** Sex / birth year / height / fallback weight — feeds calorie estimation. */
function BodyProfile({
  settings,
  updateSettings,
}: {
  settings: SettingsModel;
  updateSettings: (patch: Partial<SettingsModel>) => void;
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
    <View style={{ gap: 10 }}>
      <Txt size={12} weight="bold" color={C.inkSoft}>Sex</Txt>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["male", "female"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => updateSettings({ sex: s })}
            style={{
              backgroundColor: settings.sex === s ? C.accent : C.page2,
              borderRadius: R.sm,
              paddingHorizontal: 16,
              paddingVertical: 6,
            }}
          >
            <Txt size={13} weight="bold" color={settings.sex === s ? C.accentInk : C.inkSoft}>
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
        Used to estimate calories burnt and to normalize your rank. Weight
        prefers your latest “Body weight” entry on the Stats tab; this one is
        the fallback.
      </Txt>
    </View>
  );
}

/** The one typed goal — daily calorie burn. The rest come from the plan. */
function DailyGoals({
  settings,
  updateSettings,
}: {
  settings: SettingsModel;
  updateSettings: (patch: Partial<SettingsModel>) => void;
}) {
  const [kcal, setKcal] = useState(settings.kcalGoal ? String(settings.kcalGoal) : "");
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Daily calorie burn"
            value={kcal}
            onChange={setKcal}
            suffix="kcal"
            placeholder="300"
            onBlur={() => {
              const n = Number(kcal);
              updateSettings({ kcalGoal: n > 0 ? Math.round(n) : undefined });
            }}
          />
        </View>
        <View style={{ flex: 1 }} />
      </View>
      <Txt size={11} color={C.inkFaint}>
        Workout, set and time targets come from your training plan.
      </Txt>
    </View>
  );
}

/**
 * Account. The sign-in FORM lives on the auth gate (src/screens/Auth.tsx) —
 * here a guest just gets a button back to it, so there is exactly one place
 * in the app that validates a password.
 */
function Account() {
  const { enabled, user, signOut, exitGuest } = useAuth();
  const { syncNow } = useStore();
  const [syncing, setSyncing] = useState(false);

  if (!enabled) {
    return (
      <Txt size={13} color={C.inkFaint}>
        Cloud sync is off. Add EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env to enable it — the app
        works fully offline without them.
      </Txt>
    );
  }

  if (user) {
    return (
      <View style={{ gap: 10 }}>
        <Txt size={13} weight="semibold">Signed in as {user.email}</Txt>
        <Txt size={11} color={C.inkFaint}>
          Workouts, routines and settings sync to your account automatically.
        </Txt>
        <PrimaryButton
          label={syncing ? "Syncing…" : "Sync now"}
          disabled={syncing}
          onPress={() => {
            setSyncing(true);
            void syncNow().finally(() => setSyncing(false));
          }}
        />
        <PrimaryButton label="Sign out" background={C.page2} color={C.ink} onPress={() => void signOut()} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Txt size={13} color={C.inkFaint}>
        You are using torq offline — everything lives on this phone only.
        Sign in to back it up and sync across devices.
      </Txt>
      <PrimaryButton label="Sign in or create an account" onPress={exitGuest} />
    </View>
  );
}

/**
 * Export + delete. Play REQUIRES in-app account deletion from any app that
 * offers account creation, so this is a launch blocker rather than a nicety.
 * Export sits above it on purpose: deleting must never be the only way out.
 */
function DataSection() {
  const { exportLocal, wipeLocalData, workouts } = useStore();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"account" | "local" | null>(null);

  const doExport = async () => {
    setBusy("export");
    setNote(null);
    const res = await exportLocal();
    setBusy(null);
    if (!res.ok && res.error) setNote(res.error);
  };

  const doDeleteAccount = async () => {
    setBusy("delete");
    setNote(null);
    const res = await deleteAccount();
    if (res.error) {
      setBusy(null);
      setNote(res.error);
      return;
    }
    // The cloud copy is gone; the phone's copy must go too, or the next
    // sign-up would silently re-upload the "deleted" history.
    await wipeLocalData();
    await signOut();
    setBusy(null);
  };

  return (
    <View style={{ gap: 10 }}>
      <Txt size={12} color={C.inkFaint}>
        {workouts.length} workout{workouts.length === 1 ? "" : "s"} stored on this device.
      </Txt>
      <PrimaryButton
        label={busy === "export" ? "Preparing…" : "Export my data"}
        background={C.page2}
        color={C.ink}
        disabled={busy !== null}
        onPress={() => void doExport()}
      />
      {note ? <Txt size={12} weight="semibold" color={C.badAcc}>{note}</Txt> : null}

      {user ? (
        <PrimaryButton
          label={busy === "delete" ? "Deleting…" : "Delete my account"}
          background={C.badSurf}
          color={C.badAcc}
          disabled={busy !== null}
          onPress={() => setConfirming("account")}
        />
      ) : (
        <PrimaryButton
          label="Erase all data on this phone"
          background={C.badSurf}
          color={C.badAcc}
          disabled={busy !== null}
          onPress={() => setConfirming("local")}
        />
      )}

      {confirming === "account" ? (
        <ConfirmDialog
          title="Delete your account?"
          message={
            "This erases your account, your workouts, your rank and your " +
            "friendships — on the server AND on this phone. It cannot be " +
            "undone. Export your data first if you want to keep it."
          }
          confirmLabel="Delete everything"
          onConfirm={() => void doDeleteAccount()}
          onClose={() => setConfirming(null)}
        />
      ) : null}

      {confirming === "local" ? (
        <ConfirmDialog
          title="Erase everything on this phone?"
          message={
            "Every workout, routine and measurement stored locally will be " +
            "deleted. You have no account, so there is no cloud copy to " +
            "restore from. This cannot be undone."
          }
          confirmLabel="Erase everything"
          onConfirm={() => void wipeLocalData()}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </View>
  );
}

function Developer() {
  const { seedDemoWorkouts, removeDemoWorkouts } = useStore();
  const [proOn, setProOn] = useState(isPro());
  return (
    <View style={{ gap: 10 }}>
      <PrimaryButton
        label={proOn ? "Pro: ON (tap to turn off)" : "Pro: OFF (tap to turn on)"}
        background={C.page2}
        color={C.ink}
        onPress={() => {
          const next = !proOn;
          setProOn(next);
          void setPro(next);
        }}
      />
      <PrimaryButton
        label="Seed demo workouts (12 weeks)"
        background={C.page2}
        color={C.ink}
        onPress={seedDemoWorkouts}
      />
      <PrimaryButton
        label="Remove demo workouts"
        background={C.badSurf}
        color={C.badAcc}
        onPress={removeDemoWorkouts}
      />
      <Txt size={11} color={C.inkFaint}>
        Fake progressive PPL history for trying the charts — tagged, so
        removal only deletes seeded workouts.
      </Txt>
    </View>
  );
}

export function Settings({
  onClose,
  onRebuildPlan,
}: {
  onClose: () => void;
  onRebuildPlan: () => void;
}) {
  const { settings, updateSettings, workouts } = useStore();
  const { user, enabled } = useAuth();
  const [sub, setSub] = useState<Sub>(null);

  useEffect(() => {
    const h = BackHandler.addEventListener("hardwareBackPress", () => {
      // A sub-page installs its own handler; this one only fires for the list.
      if (sub) return false;
      onClose();
      return true;
    });
    return () => h.remove();
  }, [onClose, sub]);

  const soundOn = settings.sound !== false;
  const bodyValue = [
    settings.sex ? (settings.sex === "male" ? "Male" : "Female") : null,
    settings.weightKg ? `${Math.round(settings.weightKg)} kg` : null,
    settings.heightCm ? `${Math.round(settings.heightCm)} cm` : null,
    settings.birthYear ? String(settings.birthYear) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const planValue = settings.plan
    ? `${GOAL_LABEL[settings.plan.goal] ?? settings.plan.goal} · ${[...(settings.plan.weekdays ?? [])]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_SHORT[d])
        .join(" ")}`
    : "No plan yet";

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
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="ChevronLeft" size={24} color={C.ink} />
          </Pressable>
          <Txt size={26} weight="extrabold" style={{ flex: 1 }}>Settings</Txt>
        </View>

        <Eyebrow>You</Eyebrow>
        <Row
          icon="BicepsFlexed"
          title="Body profile"
          value={bodyValue || "Not set — calories and rank use defaults"}
          onPress={() => setSub("body")}
        />
        <Divider />
        <Row
          icon="CalendarDays"
          title="Training plan"
          value={planValue}
          onPress={onRebuildPlan}
        />
        <Divider />
        <Row
          icon="Flame"
          title="Daily goals"
          value={`${settings.kcalGoal ?? 300} kcal a day`}
          onPress={() => setSub("goals")}
        />

        <Eyebrow>App</Eyebrow>
        <Row
          icon="Scale"
          title="Units"
          right={
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["kg", "lb"] as Unit[]).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => updateSettings({ unit: u })}
                  style={{
                    backgroundColor: settings.unit === u ? C.accent : C.page2,
                    borderRadius: R.sm,
                    paddingHorizontal: 14,
                    paddingVertical: 5,
                  }}
                >
                  <Txt size={12.5} weight="bold" color={settings.unit === u ? C.accentInk : C.inkSoft}>
                    {u}
                  </Txt>
                </Pressable>
              ))}
            </View>
          }
        />
        <Divider />
        <Row
          icon="Timer"
          title="Sound effects"
          value="Set ticks, the rest countdown and the finish chime"
          right={
            <Pressable
              onPress={() => updateSettings({ sound: !soundOn })}
              style={{
                width: 52,
                height: 30,
                borderRadius: R.pill,
                padding: 3,
                backgroundColor: soundOn ? C.accent : C.page2,
                borderWidth: 1,
                borderColor: soundOn ? C.accent : C.line,
                alignItems: soundOn ? "flex-end" : "flex-start",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: R.pill,
                  backgroundColor: soundOn ? C.accentInk : C.inkFaint,
                }}
              />
            </Pressable>
          }
        />

        <Eyebrow>Account</Eyebrow>
        <Row
          icon="UserCircle"
          title={user ? (user.email ?? "Signed in") : enabled ? "Not signed in" : "Sync unavailable"}
          value={
            user
              ? "Signed in · workouts sync automatically"
              : enabled
                ? "Everything stays on this phone"
                : "No Supabase keys in this build"
          }
          onPress={() => setSub("account")}
        />

        <Eyebrow>Your data</Eyebrow>
        <Row
          icon="Save"
          title="Export and delete"
          value={`${workouts.length} workout${workouts.length === 1 ? "" : "s"} on this device`}
          onPress={() => setSub("data")}
        />

        <Eyebrow>Developer</Eyebrow>
        <Row
          icon="SlidersVertical"
          title="Developer tools"
          value="Pro toggle and demo data"
          onPress={() => setSub("dev")}
        />

        <Eyebrow>About</Eyebrow>
        <Txt size={12.5} weight="semibold">torq 1.0.0</Txt>
        <Txt size={11.5} color={C.inkFaint} style={{ marginTop: 2 }}>
          Local-first workout tracking with a real strength rank. Your logs
          never leave this phone unless you sign in.
        </Txt>
      </KeyboardAwareScrollView>

      {sub === "body" ? (
        <SubPage title="Body profile" onBack={() => setSub(null)}>
          <BodyProfile settings={settings} updateSettings={updateSettings} />
        </SubPage>
      ) : null}
      {sub === "goals" ? (
        <SubPage title="Daily goals" onBack={() => setSub(null)}>
          <DailyGoals settings={settings} updateSettings={updateSettings} />
        </SubPage>
      ) : null}
      {sub === "account" ? (
        <SubPage title="Account & sync" onBack={() => setSub(null)}>
          <Account />
        </SubPage>
      ) : null}
      {sub === "data" ? (
        <SubPage title="Your data" onBack={() => setSub(null)}>
          <DataSection />
        </SubPage>
      ) : null}
      {sub === "dev" ? (
        <SubPage title="Developer" onBack={() => setSub(null)}>
          <Developer />
        </SubPage>
      ) : null}
    </SlideUp>
  );
}
