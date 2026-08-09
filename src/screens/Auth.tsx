/**
 * Auth gate — the first thing torq shows on a cold start when cloud sync is
 * configured and nobody is signed in. Cardless dark page, spinning vortex on
 * top, sign in / create account on one screen.
 *
 * Production behaviours that matter here:
 *  - the password policy is VISIBLE while typing (src/lib/password.ts), not
 *    a rejection after submit;
 *  - submit stays disabled until the form can actually succeed, and shows a
 *    spinner instead of letting the user fire it twice;
 *  - a sign-up that needs email confirmation gets its own screen rather than
 *    silently doing nothing;
 *  - torq is local-first, so "continue without an account" is always there —
 *    the gate must never be able to lock a user out of their own logs.
 *
 * No OTP by design (Adilzhan, 2026-08-08): email + password only for now.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "../components/KeyboardAware";
import { C, FONT, R } from "../theme";
import { Icon } from "../components/Icon";
import { SpinningLogo } from "../components/Logo";
import { PopIn } from "../components/anim";
import { PrimaryButton, Txt } from "../components/ui";
import { useAuth } from "../lib/auth";
import { emailOk, passwordOk, passwordRules, passwordStrength } from "../lib/password";
import { handleOk, handleTaken, rememberSignupHandle } from "../lib/social";

type Mode = "in" | "up";

/** Labelled input with an icon, a focus ring and an optional reveal eye. */
function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  secure,
  keyboard,
  autoComplete,
  onSubmit,
  inputRef,
  tone = C.line,
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboard?: "email-address" | "default";
  autoComplete?: "email" | "password" | "new-password" | "off";
  onSubmit?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  /** Border color override — used to flag mismatch/valid states. */
  tone?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt size={11} weight="bold" color={C.inkSoft}>
        {label}
      </Txt>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: C.page2,
          borderRadius: R.sm,
          borderWidth: 1,
          borderColor: focused ? C.accent : tone,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <Icon name={icon} size={17} color={focused ? C.accent : C.inkFaint} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.inkFaint}
          secureTextEntry={secure && !reveal}
          keyboardType={keyboard ?? "default"}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={autoComplete === "email" ? "emailAddress" : undefined}
          returnKeyType={onSubmit ? "go" : "next"}
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontFamily: FONT.semibold,
            fontSize: 15,
            color: C.ink,
            padding: 0,
          }}
        />
        {secure ? (
          <Pressable hitSlop={10} onPress={() => setReveal((r) => !r)}>
            <Icon name={reveal ? "EyeOff" : "Eye"} size={17} color={C.inkFaint} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Four-segment strength meter + verdict word. */
function StrengthMeter({ password, email }: { password: string; email: string }) {
  const { score, label } = passwordStrength(password, email);
  const color =
    label === "Too weak" || label === "Weak"
      ? C.badAcc
      : label === "Fair"
        ? C.warnAcc
        : C.accent;
  const filled = Math.ceil(score * 4);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              backgroundColor: i < filled ? color : C.line,
            }}
          />
        ))}
      </View>
      <Txt size={11} weight="bold" color={color}>
        {label}
      </Txt>
    </View>
  );
}

/** The live policy checklist — the whole point of the sign-up screen. */
function RuleList({ password, email }: { password: string; email: string }) {
  return (
    <View style={{ gap: 5 }}>
      {passwordRules(password, email).map((r) => (
        <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Icon
            name={r.ok ? "Check" : "X"}
            size={13}
            color={r.ok ? C.accent : C.inkFaint}
          />
          <Txt size={12} color={r.ok ? C.inkSoft : C.inkFaint}>
            {r.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function Auth() {
  const { signIn, signUp, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  /** null = not checked yet (or too short / offline). */
  const [taken, setTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set after a sign-up that has to wait on an emailed link. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const usernameRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmRef = useRef<TextInput | null>(null);

  // Hardware back closes the "check your email" state, nothing else — the
  // gate itself is not dismissable except through the offline link.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sentTo) {
        setSentTo(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sentTo]);

  const signingUp = mode === "up";
  const nameOk = handleOk(username);

  // Availability check, debounced so typing a name is one request, not ten.
  // It runs while still anonymous — handle_taken is granted to `anon` for
  // exactly this screen (see supabase/social.sql) and answers nothing beyond
  // "that one is gone".
  useEffect(() => {
    if (!signingUp || !nameOk) {
      setTaken(null);
      setChecking(false);
      return;
    }
    let alive = true;
    setChecking(true);
    const t = setTimeout(() => {
      void handleTaken(username).then((t2) => {
        if (!alive) return;
        setTaken(t2);
        setChecking(false);
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [username, nameOk, signingUp]);

  const matches = !signingUp || (confirm.length > 0 && confirm === password);
  const canSubmit =
    emailOk(email) &&
    !busy &&
    (signingUp
      ? passwordOk(password, email) && matches && nameOk && taken !== true
      : password.length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    // Park the username BEFORE the request: sign-up returns no session here
    // (email confirmation is on), so there is no authenticated moment to
    // write the profile in. It is claimed on the first sign-in that lands.
    if (signingUp) await rememberSignupHandle(username);
    const res = signingUp ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (signingUp && "needsConfirmation" in res && res.needsConfirmation) {
      setSentTo(email.trim());
      return;
    }
    // Success with a session: AuthProvider flips and the gate unmounts.
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setConfirm("");
  };

  if (sentTo) {
    return (
      <View style={{ flex: 1, backgroundColor: C.page, padding: 24, justifyContent: "center", gap: 18 }}>
        <PopIn style={{ alignItems: "center", gap: 18 }}>
          <SpinningLogo size={84} period={5} />
          <Txt size={24} weight="extrabold">Confirm your email</Txt>
          <Txt size={14} color={C.inkSoft} style={{ textAlign: "center", lineHeight: 21 }}>
            We sent a link to{"\n"}
            <Txt size={14} weight="bold" color={C.ink}>{sentTo}</Txt>
            {"\n\n"}Open it, then come back and sign in.
          </Txt>
        </PopIn>
        <View style={{ gap: 10, marginTop: 12 }}>
          <PrimaryButton
            label="Back to sign in"
            large
            onPress={() => {
              setSentTo(null);
              setMode("in");
              setPassword("");
              setConfirm("");
            }}
          />
          <Pressable onPress={continueAsGuest} style={{ alignItems: "center", paddingVertical: 10 }}>
            <Txt size={13} weight="bold" color={C.inkSoft}>Continue without an account</Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 48, paddingBottom: 48, gap: 18 }}
      >
        {/* Brand */}
        <View style={{ alignItems: "center", gap: 14 }}>
          <SpinningLogo size={92} period={busy ? 1.1 : 6} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Txt size={34} weight="extrabold" style={{ letterSpacing: -1 }}>torq</Txt>
            <Txt size={13} color={C.inkSoft}>Rank your strength.</Txt>
          </View>
        </View>

        {/* Mode switch */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: C.page2,
            borderRadius: R.md,
            borderWidth: 1,
            borderColor: C.line,
            padding: 4,
            gap: 4,
            marginTop: 8,
          }}
        >
          {(
            [
              ["in", "Sign in"],
              ["up", "Create account"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={{
                flex: 1,
                borderRadius: R.sm,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: mode === m ? C.accent : "transparent",
              }}
            >
              <Txt size={13} weight="bold" color={mode === m ? C.accentInk : C.inkSoft}>
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>

        <Field
          icon="Mail"
          label="EMAIL"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@example.com"
          keyboard="email-address"
          autoComplete="email"
          onSubmit={() => (signingUp ? usernameRef : passwordRef).current?.focus()}
        />

        {signingUp ? (
          <View style={{ gap: 6 }}>
            <Field
              icon="UserRound"
              label="USERNAME"
              value={username}
              // Sanitised as you type rather than rejected on submit: the
              // rules are the DB's check constraint, so an unusable character
              // simply never lands in the box.
              onChange={(v) => {
                setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
                setError(null);
              }}
              placeholder="yourname"
              inputRef={usernameRef}
              onSubmit={() => passwordRef.current?.focus()}
              tone={
                username.length === 0
                  ? C.line
                  : !nameOk || taken === true
                    ? C.badAcc
                    : taken === false
                      ? C.accent
                      : C.line
              }
            />
            <Txt
              size={11}
              weight={taken === true ? "bold" : "medium"}
              color={
                username.length === 0
                  ? C.inkFaint
                  : !nameOk
                    ? C.inkFaint
                    : checking
                      ? C.inkFaint
                      : taken === true
                        ? C.badAcc
                        : taken === false
                          ? C.accent
                          : C.inkFaint
              }
            >
              {username.length === 0
                ? "How friends find you. 3–20 characters: a–z, 0–9 and _."
                : !nameOk
                  ? "3–20 characters: lowercase letters, numbers and _."
                  : checking
                    ? "Checking…"
                    : taken === true
                      ? `@${username} is taken — pick another.`
                      : taken === false
                        ? `@${username} is free.`
                        : `@${username}`}
            </Txt>
          </View>
        ) : null}

        <Field
          icon="Lock"
          label="PASSWORD"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          placeholder={signingUp ? "Make it a strong one" : "Your password"}
          secure
          autoComplete={signingUp ? "new-password" : "password"}
          inputRef={passwordRef}
          onSubmit={signingUp ? () => confirmRef.current?.focus() : submit}
        />

        {signingUp ? (
          <>
            {password.length > 0 ? <StrengthMeter password={password} email={email} /> : null}
            <RuleList password={password} email={email} />

            <Field
              icon="LockKeyhole"
              label="CONFIRM PASSWORD"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setError(null);
              }}
              placeholder="Type it again"
              secure
              autoComplete="new-password"
              inputRef={confirmRef}
              onSubmit={submit}
              tone={confirm.length === 0 ? C.line : matches ? C.accent : C.badAcc}
            />
            {confirm.length > 0 && !matches ? (
              <Txt size={12} weight="semibold" color={C.badAcc}>
                Passwords don't match.
              </Txt>
            ) : null}
          </>
        ) : null}

        {error ? (
          <PopIn>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: C.badSurf,
                borderRadius: R.sm,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Icon name="TriangleAlert" size={16} color={C.badAcc} />
              <Txt size={12.5} weight="semibold" color={C.badAcc} style={{ flex: 1 }}>
                {error}
              </Txt>
            </View>
          </PopIn>
        ) : null}

        <View style={{ marginTop: 4 }}>
          {busy ? (
            <View
              style={{
                borderRadius: R.ctrl,
                backgroundColor: C.accent,
                paddingVertical: 15,
                alignItems: "center",
              }}
            >
              <ActivityIndicator color={C.accentInk} />
            </View>
          ) : (
            <PrimaryButton
              label={signingUp ? "Create account" : "Sign in"}
              large
              disabled={!canSubmit}
              onPress={() => void submit()}
            />
          )}
        </View>

        <Pressable onPress={continueAsGuest} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Txt size={13} weight="bold" color={C.inkSoft}>Continue without an account</Txt>
        </Pressable>
        <Txt size={11} color={C.inkFaint} style={{ textAlign: "center", lineHeight: 16 }}>
          An account backs your workouts up and syncs them across devices.
          Without one, everything stays on this phone.
        </Txt>
      </KeyboardAwareScrollView>
    </View>
  );
}
