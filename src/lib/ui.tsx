import React, { createContext, useContext, useState } from "react";

export type Tab = "home" | "history" | "workout" | "exercises" | "stats";

interface UiValue {
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Plan wizard (onboarding) reopened on demand — Home's build-plan hero
   *  and Profile's Rebuild plan both route here; Root renders it. */
  planWizard: boolean;
  openPlanWizard: () => void;
  closePlanWizard: () => void;
}

const Ctx = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("home");
  const [planWizard, setPlanWizard] = useState(false);
  return (
    <Ctx.Provider
      value={{
        tab,
        setTab,
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
