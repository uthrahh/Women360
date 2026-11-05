import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/reportError";
import { SUPPORT_EMAIL } from "@/config/site";

interface State {
  failed: boolean;
}

/**
 * If a screen throws while rendering, show a calm way forward instead of a blank page: try again,
 * go back to the start, or write to us. The crash is reported (anonymously) so it gets fixed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportClientError("render", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen grid place-items-center px-6 bg-[var(--w360-bg)] text-[var(--w360-text)]">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-[var(--w360-text-muted)]">
            That screen couldn't be shown. Nothing you've logged has been lost. Try again, or start from the beginning.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ failed: false })}
              className="rounded-full bg-[var(--w360-text)] text-[var(--w360-bg)] font-medium px-6 py-3"
            >
              Try again
            </button>
            <a href="/" className="rounded-full border border-[var(--w360-border)] font-medium px-6 py-3">
              Go to the start
            </a>
          </div>
          <p className="text-sm text-[var(--w360-text-muted)]">
            Still stuck? Write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </main>
    );
  }
}

/**
 * Lets the browser tests prove the recovery screen works. It only does anything in a development
 * build, so it can never trip in production.
 */
export function ForcedFailure() {
  if (import.meta.env.DEV && typeof localStorage !== "undefined" && localStorage.getItem("w360_force_render_error") === "1") {
    throw new Error("Forced render error for the browser test");
  }
  return null;
}
