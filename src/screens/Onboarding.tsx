/**
 * Onboarding — the premium welcome flow, dark brand look (logo dark +
 * lime). Paged steps, each sliding in (direction-aware StepSlide):
 *
 *   0 welcome → 1 units → 2 about you → 3 goal → 4 days/week → 5 focus
 *   → 6 "building your plan…" theater → plan reveal (staggered cards)
 *
 * Single-choice steps auto-advance on tap; Skip (top right) marks
 * onboarded without a plan. Finish persists body stats to Settings and
 * calls applyPlan (imports exercises, writes plan routines + prefs).
 * Also reachable later from Profile → Rebuild plan.
 */
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { C, FONT, R } from "../theme";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { PopIn, Squish } from "../components/anim";
import { Txt } from "../components/ui";
import { GOAL_META, buildPlan, planDayMinutes } from "../lib/plan";
import { useStore } from "../lib/store";
import { LB_TO_KG, cmToFtIn, ftInToCm } from "../lib/units";
import type { BodyPart, PlanGoal, PlanPrefs } from "../types";

const LIME = C.accent;
const DIM = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.35)";
const CARD_BG = "rgba(255,255,255,0.07)";
const CARD_BG_ACTIVE = "rgba(200,254,35,0.14)";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const QUESTION_STEPS = 5; // steps 1..5 show progress dots

/** Direction-aware step entrance: slide in from the side + fade. */
function StepSlide({ dir, children }: { dir: 1 | -1; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 56, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** One-shot staggered entrance for the plan-reveal cards. */
function Stagger({ index, children }: { index: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 340,
      delay: 120 + index * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Endless soft pulse for the "building" logo. */
function Pulse({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

function BigButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Squish
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: LIME,
        borderRadius: R.md,
        paddingVertical: 16,
        alignItems: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Txt size={16} weight="extrabold" color={C.accentInk}>{label}</Txt>
    </Squish>
  );
}

/** Big selectable option card (single-choice steps). */
function OptionCard({
  title,
  blurb,
  icon,
  active,
  onPress,
}: {
  title: string;
  blurb?: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Squish
      onPress={onPress}
      style={{
        backgroundColor: active ? CARD_BG_ACTIVE : CARD_BG,
        borderRadius: R.md,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderWidth: 1.5,
        borderColor: active ? LIME : "transparent",
      }}
    >
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: active ? LIME : "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={20} color={active ? C.accentInk : "#fff"} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={16} weight="extrabold" color="#fff">{title}</Txt>
        {blurb ? <Txt size={12} color={DIM}>{blurb}</Txt> : null}
      </View>
    </Squish>
  );
}

/** Dark numeric field for the About-you step. */
function DarkField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Txt size={12} weight="bold" color={DIM}>{label}</Txt>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: CARD_BG,
          borderRadius: R.sm,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 6,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder ?? "0"}
          placeholderTextColor={FAINT}
          style={{ flex: 1, fontFamily: FONT.semibold, fontSize: 16, color: "#fff", padding: 0 }}
        />
        {suffix ? <Txt size={12} weight="bold" color={FAINT}>{suffix}</Txt> : null}
      </View>
    </View>
  );
}

function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 24 }}>
      <Txt size={26} weight="extrabold" color="#fff">{title}</Txt>
      {sub ? <Txt size={14} color={DIM}>{sub}</Txt> : null}
    </View>
  );
}

const FOCUS_PARTS: { part: BodyPart; label: string }[] = [
  { part: "chest", label: "Chest" },
  { part: "back", label: "Back" },
  { part: "legs", label: "Legs" },
  { part: "shoulders", label: "Shoulders" },
  { part: "arms", label: "Arms" },
  { part: "core", label: "Core" },
];

const GOAL_ICONS: Record<PlanGoal, string> = {
  muscle: "BicepsFlexed",
  lean: "Flame",
  strength: "Dumbbell",
  fit: "Sparkles",
};

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { settings, updateSettings, applyPlan } = useStore();
  const [step, setStepRaw] = useState(0);
  const dir = useRef<1 | -1>(1);
  const setStep = (next: number) => {
    dir.current = next >= step ? 1 : -1;
    setStepRaw(next);
  };
  // Answers (prefilled from settings so a rebuild keeps previous values).
  const [unit, setUnit] = useState(settings.unit);
  const [sex, setSex] = useState<"male" | "female" | null>(settings.sex ?? null);
  const isLb = unit === "lb";
  const [weight, setWeight] = useState(
    settings.weightKg ? String(Math.round(settings.unit === "lb" ? settings.weightKg / LB_TO_KG : settings.weightKg)) : "",
  );
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : "");
  const savedFtIn = settings.heightCm ? cmToFtIn(settings.heightCm) : null;
  const [heightFt, setHeightFt] = useState(savedFtIn ? String(savedFtIn.ft) : "");
  const [heightIn, setHeightIn] = useState(savedFtIn ? String(savedFtIn.inch) : "");
  const [age, setAge] = useState(
    settings.birthYear ? String(new Date().getFullYear() - settings.birthYear) : "",
  );
  const [goal, setGoal] = useState<PlanGoal | null>(settings.plan?.goal ?? null);
  const [weekdays, setWeekdays] = useState<number[]>(settings.plan?.weekdays ?? []);
  const [focus, setFocus] = useState<BodyPart[]>(settings.plan?.focus ?? []);
  const [built, setBuilt] = useState(false);

  const skip = () => {
    if (!settings.onboarded) updateSettings({ onboarded: true });
    onDone();
  };

  // Hardware back walks the steps, then closes (only if already onboarded).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0 && step < 6) {
        setStep(step - 1);
        return true;
      }
      if (settings.onboarded) {
        onDone();
        return true;
      }
      return true; // swallow — first-run onboarding isn't dismissable via Back
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, settings.onboarded]);

  const heightCm = isLb
    ? ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0)
    : Math.round(Number(height) || 0);
  const aboutValid = sex != null && Number(weight) > 0 && heightCm > 0 && Number(age) > 0;

  const daysValid = weekdays.length >= 2 && weekdays.length <= 6;
  const prefs: PlanPrefs | null =
    goal && daysValid ? { goal, weekdays, focus, createdAt: Date.now() } : null;
  const plan = prefs ? buildPlan(prefs) : [];

  // Step 6: persist everything, run the build theater, then reveal.
  useEffect(() => {
    if (step !== 6 || !prefs) return;
    updateSettings({
      unit,
      ...(sex ? { sex } : {}),
      ...(Number(weight) > 0 ? { weightKg: isLb ? Number(weight) * LB_TO_KG : Number(weight) } : {}),
      ...(heightCm > 0 ? { heightCm } : {}),
      ...(Number(age) > 0 ? { birthYear: new Date().getFullYear() - Math.round(Number(age)) } : {}),
    });
    const t = setTimeout(() => {
      applyPlan(prefs);
      setBuilt(true);
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <View style={{ flex: 1, backgroundColor: C.primary }}>
      {/* Top row: back · dots · skip */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 10,
          height: 54,
        }}
      >
        <View style={{ width: 60 }}>
          {step > 0 && step < 6 ? (
            <Pressable hitSlop={10} onPress={() => setStep(step - 1)}>
              <Icon name="ChevronLeft" size={24} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {step >= 1 && step <= QUESTION_STEPS
            ? Array.from({ length: QUESTION_STEPS }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i + 1 === step ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i + 1 <= step ? LIME : "rgba(255,255,255,0.2)",
                  }}
                />
              ))
            : null}
        </View>
        <View style={{ width: 60, alignItems: "flex-end" }}>
          {step < 6 ? (
            <Pressable hitSlop={10} onPress={skip}>
              <Txt size={13} weight="bold" color={DIM}>Skip</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>

      {step === 0 ? (
        <StepSlide key={0} dir={dir.current}>
          <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 24 }}>
            <PopIn>
              <Logo size={104} />
            </PopIn>
            <View style={{ alignItems: "center", gap: 10 }}>
              <Txt size={34} weight="extrabold" color="#fff">Torq</Txt>
              <Txt size={15} color={DIM} style={{ textAlign: "center", lineHeight: 22 }}>
                Your plan. Your progress.{"\n"}No guesswork.
              </Txt>
            </View>
            <View style={{ alignSelf: "stretch", marginTop: 24 }}>
              <BigButton label="Get started" onPress={() => setStep(1)} />
            </View>
          </View>
        </StepSlide>
      ) : null}

      {step === 1 ? (
        <StepSlide key={1} dir={dir.current}>
          <View style={{ flex: 1, padding: 24 }}>
            <StepTitle title="How do you measure?" sub="Weight and height units, used across the app." />
            <View style={{ gap: 12 }}>
              <OptionCard
                title="Metric"
                blurb="kilograms · centimetres"
                icon="Scale"
                active={unit === "kg"}
                onPress={() => setUnit("kg")}
              />
              <OptionCard
                title="Imperial"
                blurb="pounds · feet & inches"
                icon="Ruler"
                active={unit === "lb"}
                onPress={() => setUnit("lb")}
              />
            </View>
            <View style={{ marginTop: "auto" }}>
              <BigButton label="Continue" onPress={() => setStep(2)} />
            </View>
          </View>
        </StepSlide>
      ) : null}

      {step === 2 ? (
        <StepSlide key={2} dir={dir.current}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
            <StepTitle title="About you" sub="Powers your personal calorie estimates." />
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Squish styles its INNER view — flex:1 must live on a wrapper
                  (the dock/rest-pad gotcha) or the chip collapses to 0 width. */}
              {(["male", "female"] as const).map((s) => (
                <View key={s} style={{ flex: 1 }}>
                  <Squish
                    onPress={() => setSex(s)}
                    style={{
                      backgroundColor: sex === s ? CARD_BG_ACTIVE : CARD_BG,
                      borderRadius: R.sm,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: sex === s ? LIME : "transparent",
                    }}
                  >
                    <Txt size={14} weight="bold" color="#fff">{s === "male" ? "Male" : "Female"}</Txt>
                  </Squish>
                </View>
              ))}
            </View>
            {isLb ? (
              <>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <DarkField label="Weight" value={weight} onChange={setWeight} suffix="lb" placeholder="165" />
                  <DarkField label="Age" value={age} onChange={setAge} placeholder="25" />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <DarkField label="Height" value={heightFt} onChange={setHeightFt} suffix="ft" placeholder="5" />
                  <DarkField label=" " value={heightIn} onChange={setHeightIn} suffix="in" placeholder="9" />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <DarkField label="Weight" value={weight} onChange={setWeight} suffix="kg" placeholder="75" />
                <DarkField label="Height" value={height} onChange={setHeight} suffix="cm" placeholder="175" />
                <DarkField label="Age" value={age} onChange={setAge} placeholder="25" />
              </View>
            )}
            <View style={{ marginTop: 12 }}>
              <BigButton label="Continue" onPress={() => setStep(3)} disabled={!aboutValid} />
            </View>
          </ScrollView>
        </StepSlide>
      ) : null}

      {step === 3 ? (
        <StepSlide key={3} dir={dir.current}>
          <View style={{ flex: 1, padding: 24 }}>
            <StepTitle title="What's your goal?" sub="Sets your rep ranges, rest times and volume." />
            <View style={{ gap: 12 }}>
              {(Object.keys(GOAL_META) as PlanGoal[]).map((g) => (
                <OptionCard
                  key={g}
                  title={GOAL_META[g].label}
                  blurb={GOAL_META[g].blurb}
                  icon={GOAL_ICONS[g]}
                  active={goal === g}
                  onPress={() => setGoal(g)}
                />
              ))}
            </View>
            <View style={{ marginTop: "auto" }}>
              <BigButton label="Continue" onPress={() => setStep(4)} disabled={!goal} />
            </View>
          </View>
        </StepSlide>
      ) : null}

      {step === 4 ? (
        <StepSlide key={4} dir={dir.current}>
          <View style={{ flex: 1, padding: 24 }}>
            <StepTitle
              title="Which days do you train?"
              sub="Pick your training days — the rest become rest days. Your split follows from the count."
            />
            <View style={{ gap: 8 }}>
              {/* Monday-first; js getDay(): Sun 0 … Sat 6 */}
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = weekdays.includes(d);
                return (
                  <Squish
                    key={d}
                    onPress={() =>
                      setWeekdays(
                        on
                          ? weekdays.filter((x) => x !== d)
                          : weekdays.length >= 6
                            ? weekdays // keep at least one rest day
                            : [...weekdays, d],
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: on ? CARD_BG_ACTIVE : CARD_BG,
                      borderRadius: R.sm,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderWidth: 1.5,
                      borderColor: on ? LIME : "transparent",
                    }}
                  >
                    <Txt size={14} weight="bold" color="#fff">{WEEKDAYS[d]}</Txt>
                    {on ? <Icon name="Check" size={16} color={LIME} /> : null}
                  </Squish>
                );
              })}
            </View>
            <Txt size={12} weight="bold" color={FAINT} style={{ marginTop: 12 }}>
              {weekdays.length === 0
                ? "Pick at least 2 days"
                : weekdays.length === 1
                  ? "One more — you need at least 2 days"
                  : weekdays.length >= 6
                    ? "6 training days · 1 rest day (that's the max — recovery counts)"
                    : `${weekdays.length} training days · ${7 - weekdays.length} rest days`}
            </Txt>
            <View style={{ marginTop: "auto" }}>
              <BigButton label="Continue" onPress={() => setStep(5)} disabled={!daysValid} />
            </View>
          </View>
        </StepSlide>
      ) : null}

      {step === 5 ? (
        <StepSlide key={5} dir={dir.current}>
          <View style={{ flex: 1, padding: 24 }}>
            <StepTitle title="Any muscle focus?" sub="Optional — focused groups get extra sets and an extra exercise." />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {FOCUS_PARTS.map(({ part, label }) => {
                const on = focus.includes(part);
                return (
                  <Squish
                    key={part}
                    onPress={() =>
                      setFocus(on ? focus.filter((p) => p !== part) : [...focus, part])
                    }
                    style={{
                      backgroundColor: on ? LIME : CARD_BG,
                      borderRadius: R.pill,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}
                  >
                    <Txt size={14} weight="bold" color={on ? C.accentInk : "#fff"}>{label}</Txt>
                  </Squish>
                );
              })}
            </View>
            <View style={{ marginTop: "auto" }}>
              <BigButton label="Build my plan" onPress={() => setStep(6)} disabled={!prefs} />
            </View>
          </View>
        </StepSlide>
      ) : null}

      {step === 6 && !built ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28, padding: 24 }}>
          <Pulse>
            <Logo size={96} />
          </Pulse>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Txt size={18} weight="extrabold" color="#fff">Building your plan…</Txt>
            <Txt size={13} color={DIM}>
              {goal ? GOAL_META[goal].label : ""} · {weekdays.length} days a week
            </Txt>
          </View>
        </View>
      ) : null}

      {step === 6 && built ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120, gap: 12 }}>
            <PopIn>
              <StepTitle
                title="Your plan is ready"
                sub={`${plan.length} sessions a week · rest days matter too`}
              />
            </PopIn>
            {plan.map((day, i) => (
              <Stagger key={day.name} index={i}>
                <View style={{ backgroundColor: CARD_BG, borderRadius: R.md, padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt size={15} weight="extrabold" color="#fff">{day.name}</Txt>
                    <Txt size={12} weight="bold" color={LIME}>{WEEKDAYS[day.weekday]}</Txt>
                  </View>
                  <Txt size={12} color={DIM}>{day.blurb}</Txt>
                  <Txt size={12} weight="bold" color={FAINT}>
                    {day.items.length} exercises · ~{planDayMinutes(day.items)} min
                  </Txt>
                </View>
              </Stagger>
            ))}
          </ScrollView>
          <View style={{ position: "absolute", left: 24, right: 24, bottom: 28 }}>
            <Stagger index={plan.length}>
              <BigButton label="Start training" onPress={onDone} />
            </Stagger>
          </View>
        </View>
      ) : null}
    </View>
  );
}
