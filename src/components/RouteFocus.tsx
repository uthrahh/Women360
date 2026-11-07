import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** The page's main region, once it has rendered (the signed-in shells and pages load a moment after the address changes). */
function mainRegion(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main");
}

function focusMain(): boolean {
  const main = mainRegion();
  if (!main) return false;
  // Someone or something already put focus on a control inside the page (an auto-focused field): leave it.
  if (document.activeElement && document.activeElement !== document.body && main.contains(document.activeElement)) return true;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
  return true;
}

/** Gives whichever <main> is on the page the id the skip link points to, so the link always has a real, focusable target. */
function labelMain(): void {
  const main = mainRegion();
  if (!main) return;
  if (main.id !== "main-content") main.id = "main-content";
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
}

/** "Skip to main content": the first Tab stop on every page, so keyboard and screen-reader users can jump past the menu. */
export function SkipLink() {
  // Pages (and the signed-in shells) load lazily and swap, so keep the target current as the page changes.
  useEffect(() => {
    labelMain();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        labelMain();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href="#main-content"
      onClick={(e) => {
        e.preventDefault();
        focusMain();
        mainRegion()?.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--w360-bg-raised)] focus:text-[var(--w360-text)] focus:shadow-card focus:border focus:border-[var(--w360-border)] focus:text-sm focus:font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
    >
      Skip to main content
    </a>
  );
}

/**
 * A single-page app doesn't reload when she moves to another screen, so by default the page stays scrolled where it was
 * and keyboard focus is left on a link that may no longer exist (screen readers hear nothing change). On each change of
 * screen this scrolls to the top and moves focus to the main region, which a screen reader then reads from the heading.
 * It does nothing for a change that only alters the query (a different tab) or the hash (an in-page link).
 */
export function RouteFocus() {
  const { pathname, hash } = useLocation();
  // The path we last handled. Comparing paths (not "is this the first run") also holds when React runs effects twice in
  // development, and means opening a page directly leaves focus alone so the skip link is the first Tab stop.
  const handled = useRef(pathname);

  useEffect(() => {
    if (handled.current === pathname) return;
    handled.current = pathname;
    if (hash) return;
    window.scrollTo(0, 0);
    // Pages load lazily, so the main region may not exist yet: try again shortly.
    const timers = [0, 120, 400, 900].map((ms) => setTimeout(() => focusMain(), ms));
    return () => timers.forEach(clearTimeout);
  }, [pathname, hash]);

  return null;
}
