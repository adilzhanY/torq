/**
 * Supabase auth for torq. The app is local-first, so this layer stays thin:
 * it owns the session, a friendly error vocabulary, and the "continue
 * without an account" escape hatch (persisted, because a guest must not be
 * asked again on every cold start).
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { unregisterPush } from "./notifications";

type AuthResult = { error: string | null };
/** Sign-up either lands a session or waits on an emailed confirm link. */
type SignUpResult = AuthResult & { needsConfirmation?: boolean };

/** Set once the user picks "continue without an account". */
const GUEST_KEY = "torq.guest.v1";

interface AuthValue {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  /** True while the user has chosen to stay signed out (local-only). */
  guest: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Dismiss the auth gate and use the app offline. */
  continueAsGuest: () => void;
  /** Leave guest mode — sends the user back to the auth gate. */
  exitGuest: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account — try signing in.";
  if (m.includes("email not confirmed"))
    return "Confirm your email first — check your inbox for the link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "That password is too weak — pick a stronger one.";
  if (m.includes("network") || m.includes("fetch"))
    return "No connection. You can still use torq offline.";
  return message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = supabaseConfigured();
  const [loading, setLoading] = useState(enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(GUEST_KEY).then((v) => {
      if (alive && v === "1") setGuest(true);
    });
    const sb = supabase();
    if (!sb) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const sb = supabase();
    if (!sb) return { error: "Sync is not configured." };
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
    if (error) return { error: friendly(error.message) };
    // With email confirmation on, Supabase returns a user but no session.
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const sb = supabase();
    if (!sb) return { error: "Sync is not configured." };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? friendly(error.message) : null };
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuest(true);
    void AsyncStorage.setItem(GUEST_KEY, "1");
  }, []);

  const exitGuest = useCallback(() => {
    setGuest(false);
    void AsyncStorage.removeItem(GUEST_KEY);
  }, []);

  const signOut = useCallback(async () => {
    // Before the session goes: a token left behind would deliver the next
    // person's friend requests to the previous owner's phone.
    await unregisterPush().catch(() => {});
    await supabase()?.auth.signOut();
    // Signing out means "show me the gate again", not "keep me offline".
    setGuest(false);
    void AsyncStorage.removeItem(GUEST_KEY);
  }, []);

  return (
    <Ctx.Provider
      value={{
        enabled,
        loading,
        user: session?.user ?? null,
        guest,
        signUp,
        signIn,
        signOut,
        continueAsGuest,
        exitGuest,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
