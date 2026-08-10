/**
 * Freemium entitlements (PATH.md Phase 4 monetization).
 *
 * ONE place decides what is paid. The split and the price are still open
 * questions in PATH.md, so the worst possible outcome is `if (isPro)`
 * sprinkled through twenty screens, changing your mind then means an audit
 * instead of an edit. Everything here is data.
 *
 * BILLING IS NOT WIRED. Play Billing needs Adilzhan's Play account, signed
 * products and a real purchase flow, and a half-wired purchase path is worse
 * than none: it can take money without granting anything. So `unlock()` is a
 * single documented seam that currently only honours a local override, and
 * `PRO` resolves to true for everyone until it is connected, shipping a
 * paywall that blocks features before purchases work would break the app
 * for the only user it has.
 *
 * The locked decision this encodes (PATH.md): core LOGGING stays free
 * forever. Ranks, social and deep insights are the paid surface. Someone
 * who paid nothing must still be able to track every workout. That is the
 * promise that makes the paid tier feel fair rather than extortionate.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Everything that can be gated. Add here, never inline a new string. */
export type Feature =
  | "ranks"
  | "percentiles"
  | "friends"
  | "arena"
  | "shareCards"
  | "insights"
  | "cloudSync";

export interface FeatureSpec {
  /** Shown on the paywall. */
  label: string;
  /** Why someone would pay for it, the pitch, in one line. */
  pitch: string;
  free: boolean;
}

/**
 * The split. Free tier = a complete workout tracker; paid = the answers
 * nobody else gives you.
 */
export const FEATURES: Record<Feature, FeatureSpec> = {
  ranks: {
    label: "Ranks & tiers",
    pitch: "Every lift scored and tiered, normalized to your sex and bodyweight.",
    free: false,
  },
  percentiles: {
    label: "Percentiles",
    pitch: "Where you stand against 2.2 million competition lifters.",
    free: false,
  },
  friends: {
    label: "Friends",
    pitch: "Compare lift by lift with people you actually train with.",
    free: false,
  },
  arena: {
    label: "The Arena",
    pitch: "Global leaderboards, ranked fairly across every bodyweight.",
    free: false,
  },
  shareCards: {
    label: "Share cards",
    pitch: "Post your rank and your PRs as proper images.",
    free: false,
  },
  insights: {
    label: "Deep insights",
    pitch: "Long-range charts, muscle balance and progression suggestions.",
    free: false,
  },
  // Never paid: losing your data because you didn't subscribe is not a
  // business model, it is a hostage situation.
  cloudSync: {
    label: "Backup & sync",
    pitch: "Your workouts, safe across devices.",
    free: true,
  },
};

/**
 * The seam. Flip to false and the paywall becomes real; until billing is
 * connected, everyone gets everything rather than being blocked from
 * features they cannot yet buy.
 */
const BILLING_UNAVAILABLE_SO_EVERYTHING_IS_FREE = true;

const PRO_KEY = "torq.pro.v1";

let pro = false;

/** Load any stored entitlement. Called once at startup. */
export async function loadEntitlements(): Promise<void> {
  try {
    pro = (await AsyncStorage.getItem(PRO_KEY)) === "1";
  } catch {
    pro = false;
  }
}

export function isPro(): boolean {
  return pro || BILLING_UNAVAILABLE_SO_EVERYTHING_IS_FREE;
}

/** Is this feature available to the current user right now? */
export function can(feature: Feature): boolean {
  return FEATURES[feature].free || isPro();
}

/** Features a paying user unlocks, for the paywall list. */
export function paidFeatures(): { key: Feature; spec: FeatureSpec }[] {
  return (Object.keys(FEATURES) as Feature[])
    .filter((k) => !FEATURES[k].free)
    .map((key) => ({ key, spec: FEATURES[key] }));
}

/**
 * THE BILLING SEAM. When Play Billing is connected, this is the only
 * function that changes: run the purchase, verify the receipt server-side,
 * and persist on success. Everything else in the app already asks `can()`.
 */
export async function unlock(): Promise<{ ok: boolean; error: string | null }> {
  return {
    ok: false,
    error: "Purchases aren't available yet. Every feature is unlocked in the meantime.",
  };
}

/** Grant/revoke locally. Used by the dev tools and by `unlock()` on success. */
export async function setPro(on: boolean): Promise<void> {
  pro = on;
  try {
    if (on) await AsyncStorage.setItem(PRO_KEY, "1");
    else await AsyncStorage.removeItem(PRO_KEY);
  } catch {
    // In-memory grant still stands for this session.
  }
}
