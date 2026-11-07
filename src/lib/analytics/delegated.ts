import { isLongPage, depthsPassed, cleanPath, cleanText } from "./events";
import { track } from "./ga";

/**
 * Event pick-up that works by listening once at the document and reading the markup that is already there (a <nav>, a
 * <pre>, a data attribute), so none of the existing components had to change. Each listener ignores anything it doesn't recognise.
 */

// ---- navigation clicks ----

const NAV_SELECTOR = "nav, header, footer, [role='navigation'], [data-nav]";

function navArea(el: Element): "header" | "footer" | "nav" | "menu" | null {
  const region = el.closest(NAV_SELECTOR);
  if (!region) return null;
  if (region.closest("[role='menu'], [data-nav='menu']")) return "menu";
  const tag = region.tagName.toLowerCase();
  if (tag === "footer") return "footer";
  if (tag === "header") return "header";
  return "nav";
}

function describeLink(a: HTMLAnchorElement): { type: string; destination: string } {
  const href = a.getAttribute("href") ?? "";
  if (href.startsWith("mailto:")) return { type: "email", destination: "mailto" };
  if (href.startsWith("tel:")) return { type: "phone", destination: "tel" };
  if (href.startsWith("#")) return { type: "anchor", destination: cleanText(href, 60) };
  try {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return { type: "external", destination: url.host };
    return { type: url.pathname === window.location.pathname && url.hash ? "anchor" : "internal", destination: cleanPath(url.pathname) + (url.hash ? url.hash : "") };
  } catch {
    return { type: "internal", destination: cleanText(href, 60) };
  }
}

function onClick(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;

  // A copy button for a code sample.
  const copyButton = target.closest<HTMLElement>("[data-copy-code]");
  if (copyButton) {
    const holder = copyButton.closest("[data-code-sample]") ?? copyButton.parentElement;
    const code = holder?.querySelector("pre, code") ?? holder;
    track("code_copy", { code_language: languageOf(code), character_count: (code?.textContent ?? "").length, copy_method: "button" });
  }

  const control = target.closest<HTMLElement>("a[href], button");
  if (!control || control.closest("[data-no-track]")) return;
  const area = navArea(control);
  if (!area) return;
  if (control instanceof HTMLAnchorElement) {
    const { type, destination } = describeLink(control);
    track("nav_click", {
      link_area: area,
      link_text: cleanText(control.getAttribute("aria-label") || control.textContent, 40),
      link_destination: destination,
      link_type: type,
    });
  } else {
    track("nav_click", {
      link_area: area,
      link_text: cleanText(control.getAttribute("aria-label") || control.textContent, 40),
      link_destination: "none",
      link_type: "button",
    });
  }
}

// ---- copying from a code sample ----

function languageOf(el: Element | null | undefined): string {
  let node: Element | null | undefined = el;
  while (node) {
    const data = node.getAttribute?.("data-language");
    if (data) return cleanText(data, 30);
    const match = /\blanguage-([\w-]+)/.exec(node.className?.toString() ?? "");
    if (match) return match[1];
    node = node.parentElement;
  }
  const inner = el?.querySelector?.("[class*='language-']");
  const match = /\blanguage-([\w-]+)/.exec(inner?.className?.toString() ?? "");
  return match ? match[1] : "unknown";
}

function onCopy(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
  const code = anchor?.closest("pre, code, [data-code-sample]");
  if (!code) return;
  track("code_copy", { code_language: languageOf(code), character_count: selection.toString().length, copy_method: "selection" });
}

// ---- filters and search boxes (opt in with a data attribute) ----

function onChange(e: Event): void {
  const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-track-filter]") : null;
  if (!el) return;
  let value = "";
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) value = el.type === "checkbox" ? (el.checked ? "on" : "off") : el.value;
  else if (el instanceof HTMLSelectElement) value = el.selectedOptions[0]?.text || el.value;
  else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) value = el.value;
  else value = el.getAttribute("aria-pressed") ?? el.textContent ?? "";
  track("filter_change", {
    filter_name: cleanText(el.getAttribute("data-track-filter"), 40),
    filter_value: cleanText(value, 100),
    list_name: cleanText(el.getAttribute("data-track-list") || "none", 40),
  });
}

const searchTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
function onInput(e: Event): void {
  const el = e.target instanceof HTMLInputElement ? e.target.closest<HTMLInputElement>("[data-track-search]") : null;
  if (!el) return;
  clearTimeout(searchTimers.get(el));
  searchTimers.set(
    el,
    setTimeout(() => {
      const length = el.value.trim().length;
      // Only how long it is: what someone searches for can be personal, so the words never leave the page.
      if (length >= 2) track("site_search", { search_term_length: length, list_name: cleanText(el.getAttribute("data-track-list") || "none", 40) });
    }, 800)
  );
}

/** Starts the listeners above. Returns a function that removes them. */
export function installDelegatedTracking(): () => void {
  document.addEventListener("click", onClick, true);
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("input", onInput, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("copy", onCopy, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("input", onInput, true);
  };
}

// ---- scroll depth ----

/**
 * Reports 25, 50, 75 and 100 percent once each for the current page view. Counting starts at the first scroll (a page that
 * already fits mostly on screen has not been "scrolled to 75%" just by opening it), and only for pages that really scroll.
 * Returns a function that stops it; call again after a change of page to start over.
 */
export function startScrollDepthTracking(): () => void {
  const fired = new Set<number>();
  let waiting = false;

  function check(): void {
    waiting = false;
    const root = document.documentElement;
    const viewport = window.innerHeight;
    if (!isLongPage(viewport, root.scrollHeight)) return;
    for (const depth of depthsPassed(window.scrollY, viewport, root.scrollHeight)) {
      if (fired.has(depth)) continue;
      fired.add(depth);
      track("scroll_depth", { percent_scrolled: depth, page_path: cleanPath(window.location.pathname) });
    }
  }
  function onScroll(): void {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(check);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}
