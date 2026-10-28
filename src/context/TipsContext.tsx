import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface TipsValue {
  /** She asked for the tips on this screen (the Help button). */
  tipsOn: boolean;
  toggleTips: () => void;
}

const TipsContext = createContext<TipsValue>({ tipsOn: false, toggleTips: () => undefined });

/**
 * Instructions are not always on screen: each shows the first time it is met, and the Help
 * button brings them all back for the screen she is on. Moving to another screen turns them
 * off again, so asking for help on one page doesn't leave every other page cluttered.
 */
export function TipsProvider({ children }: { children: ReactNode }) {
  const [tipsOn, setTipsOn] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setTipsOn(false), [pathname]);
  const value = useMemo(() => ({ tipsOn, toggleTips: () => setTipsOn((on) => !on) }), [tipsOn]);
  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

export const useTips = () => useContext(TipsContext);
