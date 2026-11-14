import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { useFeatures } from "@/context/FeaturesContext";
import { authService } from "@/services/authService";
import { isNativeApp } from "@/lib/platform";

const DISMISS_KEY = "w360.verifyEmailDismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A quiet reminder to confirm her email address, until she does. Nothing is blocked by it: the address matters
 * because it is how she resets a forgotten password. Shown only when the server can actually send email, and never
 * to the shared demo accounts or the phone's device-only account (neither has a real inbox). She can put it away
 * for this visit.
 */
export function VerifyEmailNotice({ className }: { className?: string }) {
  const { auth } = useApp();
  const { emailVerification } = useFeatures();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const user = auth.user;
  const show = Boolean(emailVerification && user && !user.emailVerified && !user.isDemo && !isNativeApp() && !dismissed);

  // If she confirms in another tab or on her phone, this tab notices when she comes back to it.
  useEffect(() => {
    if (!show) return;
    const onFocus = () => {
      authService.fetchCurrentUser().then((u) => u.emailVerified && auth.refreshUser(u)).catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [show, auth]);

  if (!show || !user) return null;

  async function resend() {
    setStatus("sending");
    try {
      const result = await authService.resendVerification();
      if (result.alreadyVerified) auth.refreshUser({ ...user!, emailVerified: true });
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: it simply comes back next time */
    }
    setDismissed(true);
  }

  return (
    <Banner
      tone="info"
      title="Please confirm your email address"
      className={className}
      onDismiss={dismiss}
      action={
        status === "sent" ? (
          <span className="text-sm">Sent. Check your inbox (and spam folder).</span>
        ) : (
          <Button size="sm" variant="secondary" onClick={resend} disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send the link again"}
          </Button>
        )
      }
    >
      We sent a link to {user.email}. Confirming it means you can reset your password if you ever forget it.
      {status === "failed" && " Sending didn't work just now. Please try again in a minute."}
    </Banner>
  );
}
