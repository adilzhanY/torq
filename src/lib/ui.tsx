import React, { createContext, useContext, useState } from "react";

export type Tab = "home" | "history" | "workout" | "exercises" | "measure";

interface UiValue {
  tab: Tab;
  setTab: (t: Tab) => void;
}

const Ctx = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("home");
  return <Ctx.Provider value={{ tab, setTab }}>{children}</Ctx.Provider>;
}

export function useUi(): UiValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi must be used within UiProvider");
  return v;
}
