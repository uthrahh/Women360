import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { WakingNotice } from "@/components/WakingNotice";
import { AuthSky } from "./AuthSky";
import { cn } from "@/lib/utils";
import "./auth.css";

/**
 * Every sign-in screen: one card on a sky, one title, one main action. The card flies up into place when it arrives and, when
 * `leaving` is set (a successful sign-in), lifts away before the app opens.
 */
export function AuthLayout({ title, subtitle, children, leaving }: { title: string; subtitle?: string; children: ReactNode; leaving?: boolean }) {
  return (
    <div className="auth-root">
      <AuthSky />
      <ThemeToggle className="fixed top-4 right-4 sm:right-6 z-10" />
      <main className={cn("auth-card", leaving ? "w360-fly-out" : "w360-fly-in")}>
        <Link to="/" className="auth-mark" aria-label="Women360 home">
          <svg className="auth-mark__glyph" viewBox="0 0 64 64" aria-hidden focusable="false">
            <rect width="64" height="64" rx="14" fill="var(--w360-text)" />
            <path d="M14 20l8 26 10-20 10 20 8-26" fill="none" stroke="var(--w360-bg)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="5" fill="var(--w360-pop)" />
          </svg>
          Women360
        </Link>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-[var(--w360-text-muted)] text-sm mt-1.5">{subtitle}</p>}
        <WakingNotice className="mt-5" />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
