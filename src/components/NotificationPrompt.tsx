import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Hint } from "@/components/ui/Hint";
import { Button } from "@/components/ui/Button";
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
 * Asks to allow notifications (in response to a tap, as browsers require) and says
 * plainly what that buys: reminders while Women360 is open, not when it is closed.
 */
export function NotificationPrompt({ className }: { className?: string }) {
  const [state, setState] = useState<NotificationState>(notificationState);
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (state === "granted") return null;

  if (state === "unsupported") {
    return (
      <Hint id="notif-unsupported" className={`text-xs text-[var(--w360-text-muted)] ${className ?? ""}`}>
        This browser can't show notifications, so reminders appear inside Women360 while it's open.
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
  return (
    <Banner
      tone="info"
      title="Get a notification at your reminder times?"
      className={className}
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={async () => setState(await requestNotificationPermission())}>Turn on notifications</Button>
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
      You'll be notified while Women360 is open in a browser tab or window, even in the background. It can't notify you when it's closed.
    </Banner>
  );
}
