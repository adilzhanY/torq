import React, { createContext, useContext, useState } from "react";

export type Tab = "home" | "ranks" | "history" | "workout" | "exercises" | "stats";

/** Which segment of the Ranks tab is showing. It lives here rather than in
 *  Ranks' own state so other screens can deep-link into it. Profile's
 *  Friends row opens the tab already on the right segment. */
export type RanksView = "you" | "friends" | "arena";

interface UiValue {
  tab: Tab;
  setTab: (t: Tab) => void;
  ranksView: RanksView;
  setRanksView: (v: RanksView) => void;
  /** Jump straight to a segment of the Ranks tab. */
  openRanks: (v?: RanksView) => void;
  /** Plan wizard (onboarding) reopened on demand: Home's build-plan hero
   *  and Profile's Rebuild plan both route here; Root renders it. */
  planWizard: boolean;
  openPlanWizard: () => void;
  closePlanWizard: () => void;
}

const Ctx = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("home");
  const [ranksView, setRanksView] = useState<RanksView>("you");
  const [planWizard, setPlanWizard] = useState(false);
  return (
    <Ctx.Provider
      value={{
        tab,
        setTab,
        ranksView,
        setRanksView,
        openRanks: (v: RanksView = "you") => {
          setRanksView(v);
          setTab("ranks");
        },
        planWizard,
        openPlanWizard: () => setPlanWizard(true),
        closePlanWizard: () => setPlanWizard(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUi(): UiValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi must be used within UiProvider");
  return v;
}
