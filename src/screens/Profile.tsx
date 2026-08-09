/** Profile — stats summary, settings, and Supabase account/sync. No longer a
 * tab: opens as a full-screen overlay from the avatar button in the top bar. */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "../components/KeyboardAware";
import { C, R } from "../theme";
import { Icon } from "../components/Icon";
import { SlideUp } from "../components/anim";
import { Divider, Eyebrow, NumberField, PrimaryButton, TextField, Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { deleteAccount } from "../lib/social";
import { isPro, setPro } from "../lib/entitlements";
import { ConfirmDialog } from "../components/Dialog";
import { LB_TO_KG, cmToFtIn, ftInToCm } from "../lib/units";
import { bodyProfileAt } from "../lib/calories";
import { overallRank, rankLifts, stageOf, tierLabel, TIER_COLORS } from "../lib/rank";
import { RankBadge } from "../components/RankBadge";
import { Avatar } from "../components/Avatar";
import { avatarSource, pickAvatar, removeAvatar, uploadAvatar } from "../lib/avatar";
import { workoutVolume, type Settings, type Unit } from "../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt size={24} weight="extrabold">{value}</Txt>
      <Txt size={10} weight="bold" color={C.inkFaint}>{label}</Txt>
    </View>
  );
}

/**
 * Identity: the profile picture, the name, and the body line the rank is
 * normalized against. It sits ABOVE the rank block rather than inside it so
 * a brand-new user — who has no ranked lift yet — still has a face and a
 * name on this screen.
 *
 * The picture is kept on the phone first and uploaded second (see
 * lib/avatar.ts): a guest gets an avatar too, and a failed upload never
 * costs the user their choice.
 */
function IdentityRow() {
  const { settings, updateSettings, measurements } = useStore();
  const body = bodyProfileAt(settings, measurements, Date.now());
  const displayName = settings.name?.trim() || "Athlete";
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const choose = async () => {
    setBusy(true);
    setNote(null);
    const picked = await pickAvatar();
    if (picked.error) {
      setBusy(false);
      setNote(picked.error);
      return;
    }
    if (!picked.uri) {
      setBusy(false);
      return;
    }
    // Show it immediately; the upload is what can be slow or fail.
    updateSettings({ avatarUri: picked.uri, avatarUrl: undefined });
    const up = await uploadAvatar(picked.uri);
    if (up.url) updateSettings({ avatarUrl: up.url });
    else if (up.error) setNote(`Saved on this phone, but not uploaded: ${up.error}`);
    setBusy(false);
  };

  const clear = async () => {
    setBusy(true);
    setNote(null);
    updateSettings({ avatarUri: undefined, avatarUrl: undefined });
    await removeAvatar();
    setBusy(false);
  };

  const uri = avatarSource(settings);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={() => void choose()} disabled={busy}>
          <Avatar uri={uri} name={displayName} size={76} />
          {/* Camera badge — the affordance that says the picture is tappable. */}
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: C.accent,
              borderWidth: 2,
              borderColor: C.page,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Camera" size={14} color={C.accentInk} />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt size={20} weight="extrabold" numberOfLines={1}>{displayName}</Txt>
          <Txt size={12} color={C.inkSoft}>
            {Math.round(body.weightKg)} kg · {body.sex === "male" ? "M" : "F"}
          </Txt>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 2 }}>
            <Pressable onPress={() => void choose()} disabled={busy} hitSlop={6}>
              <Txt size={12} weight="bold" color={C.accent}>
                {busy ? "Working…" : uri ? "Change photo" : "Add a photo"}
              </Txt>
            </Pressable>
            {uri ? (
              <Pressable onPress={() => void clear()} disabled={busy} hitSlop={6}>
                <Txt size={12} weight="bold" color={C.inkFaint}>Remove</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {note ? (
        <Txt size={11} color={C.warnAcc}>{note}</Txt>
      ) : null}
    </View>
  );
}

/**
 * The Rank block (PATH.md Phase 1 concept, cardless build): the overall
 * shield, big DOTS points, progress to the next tier, and the top-3 best
 * lifts the score is built from — each with its own badge.
 *
 * Badges, not text chips (Adilzhan, 2026-08-09): the shield IS the rank in
 * this app, and "GOLD" spelled out in a pill threw away the one piece of art
 * the rank system has. Points/tiers only — no percentile claims here.
 */
function RankCard() {
  const { workouts, exercises, measurements, settings } = useStore();
  const profile = bodyProfileAt(settings, measurements, Date.now());
  const lifts = rankLifts(workouts, settings.unit, profile.weightKg, profile.sex);
  const overall = overallRank(lifts);
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercise";

  if (lifts.length === 0) {
    return (
      <View>
        <Eyebrow>Rank</Eyebrow>
        <Txt size={13} color={C.inkFaint}>
          Finish a workout with weighted sets (10 reps or fewer) and your
          rank appears here.
        </Txt>
      </View>
    );
  }

  const s = overall.state;
  return (
    <View>
      <Eyebrow>Rank</Eyebrow>
      {/* The shield carries the tier; the words underneath just name it. */}
      <View style={{ alignItems: "center", gap: 4, marginTop: 2 }}>
        <RankBadge tier={s.tier} stage={stageOf(s.progress)} size={168} />
        <Txt size={16} weight="extrabold" color={TIER_COLORS[s.tier]} style={{ letterSpacing: 0.4 }}>
          {tierLabel(s)}
        </Txt>
      </View>

      {/* Points + progress to the next tier */}
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 12 }}>
        <Txt size={40} weight="extrabold">{Math.round(s.points)}</Txt>
        <Txt size={14} weight="extrabold" color={C.accent}>pts</Txt>
      </View>
      <Txt size={12} color={C.inkSoft}>overall</Txt>
      <View
        style={{
          height: 6,
          borderRadius: R.pill,
          backgroundColor: C.page2,
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(s.progress * 100)}%`,
            height: "100%",
            borderRadius: R.pill,
            backgroundColor: C.accent,
          }}
        />
      </View>
      <Txt size={12} color={C.inkFaint} style={{ marginTop: 6 }}>
        {s.next ? `${Math.ceil(s.toNext)} pts to ${s.next}` : "Top of the ladder"}
      </Txt>

      {/* Best lifts (the top 3 the overall score counts) */}
      <Eyebrow>Best lifts</Eyebrow>
      <View>
        {overall.counted.map((l, i) => (
          <View key={l.exerciseId}>
            {i > 0 ? <Divider /> : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8,
              }}
            >
              <RankBadge tier={l.tier.tier} stage={stageOf(l.tier.progress)} size={52} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt size={14} weight="semibold" numberOfLines={1}>
                  {name(l.exerciseId)}
                </Txt>
                <Txt size={11.5} weight="bold" color={TIER_COLORS[l.tier.tier]}>
                  {tierLabel(l.tier)}
                </Txt>
              </View>
              <Txt size={15} weight="extrabold" style={{ minWidth: 44, textAlign: "right" }}>
                {l.e1RM}
              </Txt>
            </View>
          </View>
        ))}
      </View>
      <Txt size={10} color={C.inkFaint} style={{ marginTop: 2 }}>
        Best estimated 1RM ({settings.unit}) · DOTS-normalized to your body · warmups and 10+ rep sets excluded
      </Txt>
    </View>
  );
}

/**
 * Account section. The sign-in FORM lives on the auth gate now
 * (src/screens/Auth.tsx) — here a guest just gets a button back to it, so
 * there is exactly one place in the app that validates a password.
 */
function Account() {
  const { enabled, user, signOut, exitGuest } = useAuth();
  const { syncNow } = useStore();
  const [syncing, setSyncing] = useState(false);

  if (!enabled) {
    return (
      <View>
        <Txt size={13} color={C.inkFaint}>
          Cloud sync is off. Add EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env to enable it — the app
          works fully offline without them.
        </Txt>
      </View>
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
 * Export + delete. Play REQUIRES in-app account deletion for any app that
 * offers account creation, so this is a launch blocker rather than a
 * nicety. Export sits directly above it on purpose: deleting should never
 * be the only way out, and someone about to wipe their account should see
 * the way to keep their history first.
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
      {note ? (
        <Txt size={12} weight="semibold" color={C.badAcc}>{note}</Txt>
      ) : null}

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
        Used to estimate calories burnt. Weight prefers your latest “Body
        weight” entry on the Measure tab; this one is the fallback.
      </Txt>
    </View>
  );
}

/** The one typed goal — daily calorie burn. Everything else on the Home
 *  dashboard derives from the training plan. */
function DailyGoalsCard({
  settings,
  updateSettings,
}: {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
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
  const { workouts, settings, updateSettings, seedDemoWorkouts, removeDemoWorkouts } = useStore();
  // Dev-only: exercise the paywall before Play Billing exists.
  const [proOn, setProOn] = useState(isPro());
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
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable hitSlop={8} onPress={onClose}>
          <Icon name="ChevronLeft" size={24} color={C.ink} />
        </Pressable>
        <Txt size={26} weight="extrabold" style={{ flex: 1 }}>Profile</Txt>
      </View>

      <IdentityRow />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="WORKOUTS" value={String(workouts.length)} />
        <Stat label={`VOLUME (${settings.unit.toUpperCase()})`} value={String(Math.round(totalVolume))} />
      </View>

      <RankCard />

      <Divider />
      <Eyebrow>Settings</Eyebrow>
      <View style={{ gap: 10 }}>
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
                backgroundColor: settings.unit === u ? C.accent : C.page2,
                borderRadius: R.sm,
                paddingHorizontal: 16,
                paddingVertical: 6,
              }}
            >
              <Txt size={13} weight="bold" color={settings.unit === u ? C.accentInk : C.inkSoft}>
                {u}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      <Divider />
      <Eyebrow>Sound</Eyebrow>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt size={13} weight="semibold">Sound effects</Txt>
            <Txt size={11} color={C.inkFaint}>
              Set ticks, the 3-2-1 rest countdown and the finish chime. They
              layer over your music instead of pausing it.
            </Txt>
          </View>
          <Pressable
            onPress={() => updateSettings({ sound: settings.sound === false })}
            style={{
              width: 52,
              height: 30,
              borderRadius: R.pill,
              padding: 3,
              backgroundColor: settings.sound === false ? C.page2 : C.accent,
              borderWidth: 1,
              borderColor: settings.sound === false ? C.line : C.accent,
              alignItems: settings.sound === false ? "flex-start" : "flex-end",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: R.pill,
                backgroundColor: settings.sound === false ? C.inkFaint : C.accentInk,
              }}
            />
          </Pressable>
        </View>
      </View>

      <Divider />
      <Eyebrow>Body profile</Eyebrow>
      <BodyProfileCard settings={settings} updateSettings={updateSettings} />

      <Divider />
      <Eyebrow>Training plan</Eyebrow>
      <View style={{ gap: 10 }}>
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
      </View>

      <Divider />
      <Eyebrow>Daily goals</Eyebrow>
      <DailyGoalsCard settings={settings} updateSettings={updateSettings} />

      <Divider />
      <Eyebrow>Account & sync</Eyebrow>
      <Account />

      <Divider />
      <Eyebrow>Your data</Eyebrow>
      <DataSection />

      <Divider />
      <Eyebrow>Developer</Eyebrow>
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
    </KeyboardAwareScrollView>
    </SlideUp>
  );
}
