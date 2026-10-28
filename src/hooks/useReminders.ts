import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/components/ui/Toast";
import { habitService, HABITS_CHANGED } from "@/services/habitService";
import { isNativeApp } from "@/lib/platform";
import { localDateISO } from "@/services/mappers";
import { dueReminders, loadAnnounced, notificationState, saveAnnounced, showSystemNotification, type Announced } from "@/lib/reminders";
import type { Habit } from "@/types";

const TICK_MS = 20_000;
const REFRESH_MS = 5 * 60_000;

/**
 * Tells her when a habit's reminder time arrives. It runs while Women360 is open in a
 * browser tab or window (background tabs included) and checks every 20 seconds. If she
 * has allowed notifications it shows a system notification; if not, it shows a message
 * inside the app. It cannot reach her when the app is closed: that needs a push service.
 */
export function useReminders() {
  const { auth } = useApp();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const userId = auth.user?.role === "woman" ? auth.user.id : null;

  useEffect(() => {
    if (!userId) return;

    // The worker is what lets notifications show on phones; registering it is harmless where they are unsupported.
    if (!isNativeApp() && "serviceWorker" in navigator && notificationState() !== "unsupported") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    let habits: Habit[] = [];
    let announced: Announced = loadAnnounced();
    let busy = false;

    const refresh = () => habitService.list().then((h) => (habits = h)).catch(() => undefined);

    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        for (const habit of dueReminders(habits, new Date(), announced)) {
          // Remember first, so a slow notification can't be sent twice by the next tick.
          announced = { ...announced, [habit.id]: localDateISO() };
          saveAnnounced(announced);
          const detail = habit.target ? `${habit.target.toLocaleString()}${habit.unit ? " " + habit.unit : ""}` : "Tap to open Women360.";
          const shown = await showSystemNotification(`Time for: ${habit.title}`, detail, habit.activityCode ? "/app/activity" : "/app/habits");
          if (!shown) toastRef.current.show(`Time for: ${habit.title}`);
        }
      } finally {
        busy = false;
      }
    };

    void refresh().then(tick);
    const tickId = setInterval(tick, TICK_MS);
    const refreshId = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh().then(tick);
    };
    const onChanged = () => void refresh().then(tick);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(HABITS_CHANGED, onChanged);
    return () => {
      clearInterval(tickId);
      clearInterval(refreshId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(HABITS_CHANGED, onChanged);
    };
  }, [userId]);
}
