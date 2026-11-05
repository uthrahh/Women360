import { ApiError } from "@/services/apiClient";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
let sent = 0;
const seen = new Set<string>();

/** "/app/goals/ckx9abc123def456" -> "/app/goals/:id": the screen, never a person's record. */
export function routeShape(pathname: string): string {
  return (
    pathname
      .split(/[?#]/)[0]
      .split("/")
      .map((part) => (/^[0-9a-f-]{8,}$/i.test(part) || /^c[a-z0-9]{20,}$/.test(part) || /^\d+$/.test(part) ? ":id" : part))
      .join("/")
      .replace(/[^A-Za-z0-9\-_/:]/g, "")
      .slice(0, 120) || "/"
  );
}

/**
 * Tells the people who run Women360 that a screen crashed in someone's browser. It sends only a short
 * technical message and the screen, with no sign-in, no account, and nothing she typed. A handful per
 * visit at most, and never anything about a failed network call (the server already reports those).
 */
export function reportClientError(kind: "render" | "unhandled", error: unknown): void {
  try {
    if (error instanceof ApiError) return;
    const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 200) || "unknown";
    const route = routeShape(window.location.pathname);
    const key = `${kind}:${route}:${message}`;
    if (sent >= 5 || seen.has(key)) return;
    seen.add(key);
    sent += 1;
    void fetch(`${BASE_URL}/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, message, route }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting a crash must never cause another one.
  }
}

/** Catches errors nothing else caught: in event handlers and in promises nobody awaited. */
export function installGlobalErrorReporting(): void {
  window.addEventListener("error", (e) => reportClientError("unhandled", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportClientError("unhandled", e.reason));
}
