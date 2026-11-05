import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { request } from "@/services/apiClient";

/** The screens that are counted. The server holds the same fixed list and ignores anything else. */
const SCREENS = ["dashboard", "cycle", "nutrition", "activity", "sleep", "wellbeing", "habits", "goals", "health", "insights", "reports", "messages", "settings", "learn"];

/** True when the browser asks not to be tracked. Women360's counts are anonymous, but the request is honoured anyway. */
function doNotTrack(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/**
 * Tells the server which screen a signed-in woman opened, so the people who run Women360 can see which parts are used.
 * It sends only the screen's name: no identifier, nothing she typed. Shared demonstration accounts and browsers that
 * ask not to be tracked send nothing. Failures are ignored: counting never gets in her way.
 */
export function useUsageTracking() {
  const { auth } = useApp();
  const { pathname } = useLocation();
  const last = useRef<string | null>(null);
  const counted = auth.user?.role === "woman" && !auth.user.isDemo;

  useEffect(() => {
    if (!counted || doNotTrack()) return;
    const screen = pathname.split("/")[2];
    if (!screen || !SCREENS.includes(screen) || screen === last.current) return;
    last.current = screen;
    request("/usage/view", { method: "POST", body: JSON.stringify({ screen }) }).catch(() => undefined);
  }, [counted, pathname]);
}
