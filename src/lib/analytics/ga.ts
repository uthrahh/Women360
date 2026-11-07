import { isNativeApp } from "@/lib/platform";
import { PREVIEW_PATH, cleanPath, cleanText, isTrackedPath, isValidEventName, isValidParamName } from "./events";

/**
 * Google Analytics 4, held to Women360's privacy promises. It does nothing at all unless ALL of these hold:
 *   - the build has a Measurement ID (VITE_GA_MEASUREMENT_ID); without one there is no banner, no request, no script;
 *   - the page was first opened on a public page (the site's security policy only lets Google's script run there);
 *   - the visitor chose "Accept" (the script is not even downloaded before that);
 *   - the browser is not sending Do Not Track or Global Privacy Control;
 *   - and, for each event, the current page is one of the public pages. The signed-in app, sign-in, admin and coach screens are never reported.
 */

export type Consent = "granted" | "denied" | "unset";
type Params = Record<string, string | number | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const STORAGE_KEY = "w360:analytics-consent";
export const CONSENT_EVENT = "w360:analytics-consent";
export const OPEN_CHOICES_EVENT = "w360:analytics-open-choices";

const rawId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();
export const MEASUREMENT_ID: string | null = ID_PATTERN.test(rawId) ? rawId : null;

// The page the document was first loaded on. The Content-Security-Policy that lets Google's script run is sent only with the public pages,
// so analytics is only offered when the visit began on one (moving around inside the site never loads a new policy).
const startedOnPublicPage = typeof window !== "undefined" && isTrackedPath(window.location.pathname);

export function analyticsEnabled(): boolean {
  return MEASUREMENT_ID !== null && startedOnPublicPage && !isNativeApp();
}

/** The browser asks not to be tracked: treated as a "no", and no question is asked. */
export function browserOptedOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export function getConsent(): Consent {
  if (browserOptedOut()) return "denied";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unset";
  } catch {
    return "unset";
  }
}

// ---- what happened, for the reference page's on-page log ----

export interface EmittedEvent {
  time: number;
  name: string;
  params: Record<string, string | number>;
  sent: boolean;
  /** Why it was not sent to Google. */
  reason?: string;
}
type Listener = (event: EmittedEvent) => void;
const listeners = new Set<Listener>();
export function onAnalyticsEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- loading Google's script, only after "Accept" ----

let loaded = false;
function load(): void {
  if (loaded || !MEASUREMENT_ID) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the `arguments` object itself, so this must not be an arrow function or use rest parameters.
  window.gtag = function () {
    (window.dataLayer as unknown[]).push(arguments);
  };
  const gtag = window.gtag;
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  gtag("consent", "update", { analytics_storage: "granted" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Switches Google's collection on for the public pages and hard off everywhere else (their documented opt-out flag), including after a client-side move into the app. */
export function syncCollection(pathname: string): void {
  if (!MEASUREMENT_ID || typeof window === "undefined") return;
  window[`ga-disable-${MEASUREMENT_ID}`] = !(isTrackedPath(pathname) && getConsent() === "granted");
}

function deleteGoogleCookies(): void {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0].trim();
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid") {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

export function setConsent(choice: "granted" | "denied"): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the choice holds for this visit only (the banner would ask again next time).
  }
  if (choice === "granted") {
    if (analyticsEnabled()) load();
  } else if (loaded && window.gtag) {
    window.gtag("consent", "update", { analytics_storage: "denied" });
    deleteGoogleCookies();
  }
  syncCollection(window.location.pathname);
  window.dispatchEvent(new Event(CONSENT_EVENT));
  if (choice === "granted") trackPageView(true);
}

/** Brings the question back (the footer's "Analytics choices"). */
export function openChoices(): void {
  window.dispatchEvent(new Event(OPEN_CHOICES_EVENT));
}

/** Starts Google's script on a later visit, when the person already said yes. */
export function resumeIfConsented(): void {
  if (analyticsEnabled() && getConsent() === "granted") load();
}

// ---- sending ----

function buildParams(params: Params): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!isValidParamName(key) || value === undefined) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
    } else {
      const text = cleanText(value);
      if (text) out[key] = text;
    }
  }
  return out;
}

/**
 * Records that something happened. Public pages only (and the reference page, which only shows it on screen). Whether it
 * is actually sent to Google is decided here, so no caller can get it wrong.
 */
export function track(name: string, params: Params = {}): void {
  const path = cleanPath(window.location.pathname);
  const preview = path === PREVIEW_PATH;
  if (!preview && !isTrackedPath(path)) return;
  if (!isValidEventName(name)) return;

  const clean = buildParams(params);
  let sent = false;
  let reason: string | undefined;
  if (preview) reason = "This is the reference page. Events appear here so they can be reviewed, and are never sent.";
  else if (!analyticsEnabled()) reason = "Analytics is not switched on in this build.";
  else if (getConsent() !== "granted") reason = "The visitor has not said yes.";
  else {
    load();
    window.gtag?.("event", name, clean);
    sent = true;
  }
  const event: EmittedEvent = { time: Date.now(), name, params: clean, sent, reason };
  listeners.forEach((listener) => listener(event));
}

let lastView = { path: "", at: 0 };
/**
 * One page_view per change of page (also guards against React running an effect twice in development). `force` skips that guard:
 * used when someone has just said yes, so the page they are on is reported even if it was opened a moment ago.
 */
export function trackPageView(force = false): void {
  const path = cleanPath(window.location.pathname);
  const now = Date.now();
  if (!force && lastView.path === path && now - lastView.at < 400) return;
  lastView = { path, at: now };
  track("page_view", {
    page_path: path,
    page_title: document.title,
    page_location: `${window.location.origin}${path}`,
  });
}
