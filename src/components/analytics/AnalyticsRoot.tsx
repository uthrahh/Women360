import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { installDelegatedTracking, startScrollDepthTracking } from "@/lib/analytics/delegated";
import { PREVIEW_PATH, cleanPath, isTrackedPath } from "@/lib/analytics/events";
import { OPEN_CHOICES_EVENT, analyticsEnabled, browserOptedOut, openChoices, resumeIfConsented, setConsent, syncCollection, trackPageView } from "@/lib/analytics/ga";
import { useConsent } from "@/lib/analytics/useConsent";

/**
 * Wires Google Analytics into the router without touching any page: one page view per change of public page, the
 * delegated listeners, scroll depth, and the question. Renders nothing at all unless analytics is switched on in this build.
 */
export function AnalyticsRoot() {
  const { pathname } = useLocation();
  const path = cleanPath(pathname);
  const watched = isTrackedPath(path) || path === PREVIEW_PATH;

  // The listeners are cheap and read only the page; they stay on for the whole visit and every event decides for itself.
  useEffect(() => installDelegatedTracking(), []);

  useEffect(() => {
    resumeIfConsented();
    syncCollection(path);
    if (!watched) return;
    trackPageView();
    return startScrollDepthTracking();
  }, [path, watched]);

  return <ConsentBanner path={path} />;
}

function ConsentBanner({ path }: { path: string }) {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CHOICES_EVENT, open);
    return () => window.removeEventListener(OPEN_CHOICES_EVENT, open);
  }, []);

  // Nothing to ask unless there is something to switch on, on a page it would apply to, and the browser hasn't already said no.
  if (!analyticsEnabled() || !isTrackedPath(path) || browserOptedOut()) return null;
  if (consent !== "unset" && !reopened) return null;

  const choose = (choice: "granted" | "denied") => {
    setConsent(choice);
    setReopened(false);
  };

  return (
    <section
      aria-label="Analytics choice"
      className="fixed inset-x-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[70] rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] shadow-card p-4 text-sm"
    >
      <p className="font-medium">Help us see what is useful?</p>
      <p className="mt-1.5 text-[var(--w360-text-muted)] leading-relaxed">
        With your OK, we use Google Analytics on the public pages (home, privacy, terms and release notes) to count visits and which links are used. Never inside
        your account, and never anything you log or type. You can change this later from the footer.{" "}
        <Link to="/privacy" className="underline underline-offset-2">Privacy summary</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => choose("granted")}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={() => choose("denied")}>Decline</Button>
      </div>
      {consent !== "unset" && <p className="mt-2 text-xs text-[var(--w360-text-muted)]">Currently: {consent === "granted" ? "accepted" : "declined"}.</p>}
    </section>
  );
}

/** The footer's way back to the question. Shows only when analytics is switched on and the browser hasn't opted out. */
export function AnalyticsChoicesLink({ className }: { className?: string }) {
  if (!analyticsEnabled() || browserOptedOut()) return null;
  return (
    <>
      <span className="mx-2">·</span>
      <button type="button" onClick={openChoices} className={className ?? "underline underline-offset-2 hover:text-[var(--w360-text)]"}>
        Analytics choices
      </button>
    </>
  );
}
