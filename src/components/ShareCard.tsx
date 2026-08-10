/**
 * Share cards (PATH.md Phase 3 — "the marketing engine, treat it as a
 * first-class feature"): a rank or a workout as a 4:5 image for stories and
 * reels, captured straight off the rendered view.
 *
 * Why a VISIBLE preview instead of an off-screen capture: on Android a view
 * parked outside the window can capture blank, and a person about to post
 * something to their story deserves to see it first. So the card IS the
 * overlay — what you look at is exactly what gets shared.
 *
 * Libraries checked against the SDK 57 docs (AGENTS.md): react-native-view-shot
 * `captureRef` and `expo-sharing`, both included in Expo Go. Output is
 * 1080×1350 physical pixels — the doc's PixelRatio trick, since captureRef
 * sizes in logical points.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, PixelRatio, Pressable, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { RankBadge } from "./RankBadge";
import { SlideUp } from "./anim";
import { PrimaryButton, Txt } from "./ui";
import { tierLabel, type TierState } from "../lib/rank";

/** On-screen card size; the capture is scaled up from this. */
export const CARD_W = 300;
export const CARD_H = 375;
const OUT_W = 1080;
const OUT_H = 1350;

/** Brand row every card face starts with. */
function CardBrand({ right }: { right?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Logo size={22} />
      <Txt size={16} weight="extrabold" style={{ letterSpacing: -0.5, flex: 1 }}>torq</Txt>
      {right ? (
        <Txt size={10} weight="bold" color={C.inkFaint}>{right}</Txt>
      ) : null}
    </View>
  );
}

function CardFooter({ text }: { text: string }) {
  return (
    <Txt size={9} weight="bold" color={C.inkFaint} style={{ letterSpacing: 1.2 }}>
      {text}
    </Txt>
  );
}

/**
 * The overlay: renders whatever face it's given, captures that exact view,
 * and hands the PNG to the system share sheet.
 */
export function ShareSheet({
  children,
  dialogTitle,
  onClose,
}: {
  children: React.ReactNode;
  dialogTitle: string;
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setError("Sharing isn't available on this device.");
        return;
      }
      const ratio = PixelRatio.get();
      const uri = await captureRef(cardRef, {
        result: "tmpfile",
        format: "png",
        quality: 1,
        // captureRef sizes in logical points — divide by the device ratio to
        // land on the physical pixel count we actually want.
        width: OUT_W / ratio,
        height: OUT_H / ratio,
      });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SlideUp
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.scrimDeep,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 18,
      }}
    >
      <View
        ref={cardRef}
        collapsable={false}
        style={{
          width: CARD_W,
          height: CARD_H,
          backgroundColor: C.page,
          borderRadius: R.lg,
          borderWidth: 1,
          borderColor: C.line,
          padding: 20,
          overflow: "hidden",
        }}
      >
        {children}
      </View>

      {error ? (
        <Txt size={12} weight="semibold" color={C.badAcc} style={{ textAlign: "center" }}>
          {error}
        </Txt>
      ) : null}

      <View style={{ width: CARD_W, gap: 10 }}>
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
          <PrimaryButton label="Share this card" large onPress={() => void share()} />
        )}
        <Pressable onPress={onClose} style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="X" size={15} color={C.inkSoft} />
            <Txt size={13} weight="bold" color={C.inkSoft}>Close</Txt>
          </View>
        </Pressable>
      </View>
    </SlideUp>
  );
}

export interface ShareLift {
  name: string;
  e1RM: number;
  unit: string;
}

/** Face 1: the rank card. */
export function ShareRankCard({
  state,
  stage,
  displayName,
  handle,
  bodyweightKg,
  sex,
  lifts,
  percentile,
  onClose,
}: {
  state: TierState;
  stage: 1 | 2 | 3 | 4;
  displayName: string;
  handle?: string;
  bodyweightKg: number;
  sex: "male" | "female";
  lifts: ShareLift[];
  /** Optional "Top 8% · Bench Press" line. Only the competition lifts have
   *  a real distribution behind them, so this is often absent. */
  percentile?: { text: string; lift: string };
  onClose: () => void;
}) {
  return (
    <ShareSheet dialogTitle="Share your rank" onClose={onClose}>
      <CardBrand right={`${Math.round(bodyweightKg)} KG · ${sex === "male" ? "M" : "F"}`} />

      <View style={{ alignItems: "center", marginTop: 10 }}>
        <RankBadge tier={state.tier} stage={stage} size={132} />
        <Txt size={19} weight="extrabold" color={C.accent} style={{ marginTop: 2 }}>
          {tierLabel(state)}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 2 }}>
          <Txt size={40} weight="extrabold">{Math.round(state.points)}</Txt>
          <Txt size={13} weight="extrabold" color={C.inkSoft}>pts</Txt>
        </View>
        <Txt size={12} weight="bold" color={C.inkSoft} numberOfLines={1} style={{ marginTop: 2 }}>
          {handle ? `@${handle}` : displayName}
        </Txt>
      </View>

      {percentile ? (
        <View
          style={{
            marginTop: 10,
            alignSelf: "center",
            borderRadius: R.pill,
            backgroundColor: "rgba(200,254,35,0.14)",
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Txt size={11} weight="extrabold" color={C.accent}>
            {percentile.text} of competitive lifters · {percentile.lift}
          </Txt>
        </View>
      ) : null}

      <View style={{ marginTop: 12, gap: 5 }}>
        {lifts.slice(0, 3).map((l) => (
          <View key={l.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 3, height: 3, borderRadius: 99, backgroundColor: C.accent }} />
            <Txt size={11.5} weight="semibold" color={C.inkSoft} numberOfLines={1} style={{ flex: 1 }}>
              {l.name}
            </Txt>
            <Txt size={11.5} weight="extrabold">{l.e1RM} {l.unit}</Txt>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <CardFooter text="RANK YOUR STRENGTH · DOTS-NORMALIZED" />
    </ShareSheet>
  );
}

export interface ShareStat {
  icon: string;
  value: string;
  label: string;
}

/** Face 2: a finished workout, PRs first. */
export function ShareWorkoutCard({
  title,
  date,
  stats,
  prs,
  exercises,
  onClose,
}: {
  title: string;
  date: string;
  stats: ShareStat[];
  /** "Bench Press · 100 kg × 5" lines for the sets that set records. */
  prs: string[];
  /** Fallback lines when the session set no records. */
  exercises: string[];
  onClose: () => void;
}) {
  const lines = prs.length > 0 ? prs : exercises;
  return (
    <ShareSheet dialogTitle="Share your workout" onClose={onClose}>
      <CardBrand />

      <View style={{ marginTop: 14 }}>
        <Txt size={22} weight="extrabold" numberOfLines={2}>{title}</Txt>
        <Txt size={11} weight="bold" color={C.inkFaint} style={{ marginTop: 2 }}>{date}</Txt>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
        {stats.map((st) => (
          <View key={st.label} style={{ width: "50%", marginBottom: 12, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={st.icon} size={13} color={C.accent} />
              <Txt size={18} weight="extrabold">{st.value}</Txt>
            </View>
            <Txt size={9} weight="bold" color={C.inkFaint}>{st.label}</Txt>
          </View>
        ))}
      </View>

      <Txt size={9} weight="bold" color={C.inkFaint} style={{ letterSpacing: 1.2, marginBottom: 6 }}>
        {prs.length > 0 ? "PERSONAL RECORDS" : "THE WORK"}
      </Txt>
      <View style={{ gap: 4 }}>
        {lines.slice(0, 4).map((l, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 99,
                backgroundColor: prs.length > 0 ? C.gold : C.accent,
              }}
            />
            <Txt size={11} weight="semibold" color={C.inkSoft} numberOfLines={1} style={{ flex: 1 }}>
              {l}
            </Txt>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <CardFooter text="TRACKED WITH TORQ" />
    </ShareSheet>
  );
}
