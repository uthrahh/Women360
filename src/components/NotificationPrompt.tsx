import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { notificationState, requestNotificationPermission, type NotificationState } from "@/lib/reminders";

/**
 * Asks to allow notifications (in response to a tap, as browsers require) and says
 * plainly what that buys: reminders while Women360 is open, not when it is closed.
 */
export function NotificationPrompt({ className }: { className?: string }) {
  const [state, setState] = useState<NotificationState>(notificationState);

  if (state === "granted") return null;

  if (state === "unsupported") {
    return (
      <p className={`text-xs text-[var(--w360-text-muted)] ${className ?? ""}`}>
        This browser can't show notifications, so reminders appear inside Women360 while it's open.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className={`text-xs text-[var(--w360-text-muted)] ${className ?? ""}`}>
        Notifications are blocked for this site in your browser settings. Reminders will still appear inside Women360 while it's open.
      </p>
    );
  }
  return (
    <Banner
      tone="info"
      title="Get a notification at your reminder times?"
      className={className}
      action={<Button size="sm" onClick={async () => setState(await requestNotificationPermission())}>Turn on notifications</Button>}
    >
      You'll be notified while Women360 is open in a browser tab or window, even in the background. It can't notify you when it's closed.
    </Banner>
  );
}
