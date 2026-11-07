import { useSyncExternalStore } from "react";
import { CONSENT_EVENT, getConsent, type Consent } from "./ga";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The visitor's current analytics choice, kept in step across the banner, the footer link and other tabs. */
export function useConsent(): Consent {
  return useSyncExternalStore(subscribe, getConsent, () => "unset" as Consent);
}
