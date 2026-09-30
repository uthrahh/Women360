import { Capacitor } from "@capacitor/core";

// True only inside the native Android/iOS wrapper (Capacitor's bridge is
// present), never in a regular browser tab — including this same site
// opened directly in mobile Chrome. Used to gate the testing-phase,
// no-login device account flow to the installed app only.
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
