import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Hint } from "@/components/ui/Hint";
import { Button } from "@/components/ui/Button";
import { useFeatures } from "@/context/FeaturesContext";
import { enablePush, needsHomeScreenForPush, pushIsOn, pushSupported } from "@/lib/push";
import { notificationState, requestNotificationPermission, type NotificationState } from "@/lib/reminders";

const DISMISSED_KEY = "w360:notif-prompt-dismissed";
function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Storage unavailable: the prompt will simply ask again next visit.
  }
}

/**
 * Asks to allow reminders (in response to a tap, as browsers require) and says plainly what that buys.
 * Where the server can send reminders while the app is closed (web push) it turns that on, which also
 * covers the open-app case; elsewhere it offers notifications while Women360 is open and says so.
 */
export function NotificationPrompt({ className }: { className?: string }) {
  const { pushPublicKey } = useFeatures();
  const canPush = pushSupported() && pushPublicKey !== null;
  const [state, setState] = useState<NotificationState>(notificationState);
  const [pushOn, setPushOn] = useState<boolean | null>(canPush ? null : false);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!canPush) return;
    let live = true;
    void pushIsOn().then((on) => live && setPushOn(on));
    return () => {
      live = false;
    };
  }, [canPush]);

  // Fully set up: nothing to show. (While we find out whether push is on, show nothing rather than flash a prompt.)
  if (canPush ? pushOn !== false : state === "granted") return null;

  if (state === "unsupported") {
    return (
      <Hint id="notif-unsupported" className={`text-xs text-[var(--w360-text-muted)] ${className ?? ""}`}>
        {needsHomeScreenForPush()
          ? "On iPhone and iPad, add Women360 to your Home Screen (Share, then Add to Home Screen) to get reminders when it's closed. Until then, reminders appear inside Women360 while it's open."
          : "This browser can't show notifications, so reminders appear inside Women360 while it's open."}
      </Hint>
    );
  }
  if (state === "denied") {
    return (
      <Hint id="notif-denied" className={`text-xs text-[var(--w360-text-muted)] ${className ?? ""}`}>
        Notifications are blocked for this site in your browser settings. Reminders will still appear inside Women360 while it's open.
      </Hint>
    );
  }
  if (dismissed) return null;

  const turnOn = async () => {
    setProblem(null);
    if (!canPush) {
      setState(await requestNotificationPermission());
      return;
    }
    setWorking(true);
    const outcome = await enablePush(pushPublicKey);
    setWorking(false);
    setState(notificationState());
    if (outcome === "on") setPushOn(true);
    else if (outcome === "error") setProblem("We couldn't set that up just now. You can try again later in Settings > Reminders.");
  };

  return (
    <Banner
      tone="info"
      title={canPush ? "Get a reminder even when Women360 is closed?" : "Get a notification at your reminder times?"}
      className={className}
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={turnOn} disabled={working}>{working ? "Setting up…" : canPush ? "Turn on reminders" : "Turn on notifications"}</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              rememberDismissed();
              setDismissed(true);
            }}
          >
            Not now
          </Button>
        </div>
      }
    >
      {canPush
        ? "You'll get a short notification at each reminder time, on this device. It doesn't say what the reminder is for. You can turn it off any time in Settings > Reminders."
        : "You'll be notified while Women360 is open in a browser tab or window, even in the background. It can't notify you when it's closed."}
      {problem && <span className="block mt-1">{problem}</span>}
    </Banner>
  );
}
