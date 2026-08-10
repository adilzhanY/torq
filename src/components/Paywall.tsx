/**
 * Paywall (PATH.md Phase 4 monetization).
 *
 * Deliberately not a wall in front of the app: torq's free tier is a
 * complete workout tracker, and this only ever appears when someone reaches
 * for a paid surface. It leads with what they were reaching for, not with a
 * price.
 *
 * Billing is not connected yet (see lib/entitlements.ts), so `unlock()`
 * returns an honest "not available", and every feature is currently
 * unlocked anyway. This screen is the plumbing, ready for the day products
 * exist.
 */
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { SpinningLogo } from "./Logo";
import { SlideUp } from "./anim";
import { PrimaryButton, Txt } from "./ui";
import { FEATURES, paidFeatures, unlock, type Feature } from "../lib/entitlements";

export function Paywall({
  /** What the user just tried to reach: shown first. */
  feature,
  onClose,
}: {
  feature?: Feature;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const buy = async () => {
    setBusy(true);
    setError(null);
    const res = await unlock();
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  };

  // Put whatever they reached for at the top of the list.
  const items = paidFeatures().sort((a, b) =>
    a.key === feature ? -1 : b.key === feature ? 1 : 0,
  );

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
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <SpinningLogo size={72} period={7} />
          <Txt size={26} weight="extrabold" style={{ textAlign: "center" }}>
            {feature ? FEATURES[feature].label : "torq pro"}
          </Txt>
          <Txt size={14} color={C.inkSoft} style={{ textAlign: "center", lineHeight: 21 }}>
            {feature
              ? FEATURES[feature].pitch
              : "The part that tells you how good you actually are."}
          </Txt>
        </View>

        <View style={{ gap: 12, marginTop: 28 }}>
          {items.map(({ key, spec }) => (
            <View key={key} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Icon name="Check" size={16} color={C.accent} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt size={14} weight="bold">{spec.label}</Txt>
                <Txt size={12} color={C.inkSoft}>{spec.pitch}</Txt>
              </View>
            </View>
          ))}
        </View>

        {/* The free tier, stated plainly. Nobody should fear losing their log. */}
        <View
          style={{
            marginTop: 24,
            backgroundColor: C.page2,
            borderRadius: R.sm,
            borderWidth: 1,
            borderColor: C.line,
            padding: 14,
            gap: 4,
          }}
        >
          <Txt size={12.5} weight="bold">Always free</Txt>
          <Txt size={12} color={C.inkSoft}>
            Logging every workout, your full history, your routines, your
            plan, and backup, so your training can never be held hostage.
          </Txt>
        </View>

        {error ? (
          <Txt size={12.5} weight="semibold" color={C.warnAcc} style={{ marginTop: 18 }}>
            {error}
          </Txt>
        ) : null}

        <View style={{ gap: 10, marginTop: 24 }}>
          <PrimaryButton
            label={busy ? "Please wait…" : "Unlock torq pro"}
            large
            disabled={busy}
            onPress={() => void buy()}
          />
          <Pressable onPress={onClose} style={{ alignItems: "center", paddingVertical: 10 }}>
            <Txt size={13} weight="bold" color={C.inkSoft}>Not now</Txt>
          </Pressable>
        </View>
      </ScrollView>
    </SlideUp>
  );
}

/**
 * The in-place lock shown where a paid surface would be. Keeps the app
 * legible rather than blank, and only ever appears when `can()` is false,
 * which, until billing is connected, is never.
 */
export function LockedPanel({
  feature,
  onUnlock,
}: {
  feature: Feature;
  onUnlock: () => void;
}) {
  const spec = FEATURES[feature];
  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: C.page2,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: C.line,
        padding: 16,
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <Icon name="Medal" size={20} color={C.accent} />
      <Txt size={15} weight="extrabold">{spec.label}</Txt>
      <Txt size={12.5} color={C.inkSoft}>{spec.pitch}</Txt>
      <PrimaryButton label="See what's included" onPress={onUnlock} />
    </View>
  );
}
