/**
 * The Google Analytics 4 events Women360 can send. This file is the single source of truth: the code that sends them
 * builds its payloads from these definitions, and the reference page (/analytics-reference) renders its tables from them,
 * so the documentation cannot drift from the behaviour.
 *
 * Naming follows GA4's rules: snake_case, starts with a letter, at most 40 characters, nothing starting with ga_, google_
 * or firebase_, and no name that GA4 already collects for itself (click, scroll, search, file_download...), because a custom
 * event with a reserved name is ignored or double counted. Values are at most 100 characters.
 *
 * Privacy limits that hold for every event: only on public pages (never signed-in screens), only after the visitor said yes,
 * never what someone typed or copied (only its length), never a query string, an email address or an account detail.
 */

export type ParamType = "string" | "number";

export interface EventParam {
  name: string;
  type: ParamType;
  description: string;
  example: string | number;
}

export interface EventDefinition {
  name: string;
  /** What the person did. */
  trigger: string;
  /** Where in the page it is picked up, and what else it needs. */
  how: string;
  params: EventParam[];
}

export const EVENTS: EventDefinition[] = [
  {
    name: "page_view",
    trigger: "A public page is opened, or the visitor moves to another public page.",
    how: "Sent by the router wrapper on every change of public page, instead of GA4's automatic page view (switched off in the tag), so that the signed-in app is never reported.",
    params: [
      { name: "page_path", type: "string", description: "The path only: no query string, no hash.", example: "/privacy" },
      { name: "page_title", type: "string", description: "The page's title.", example: "Privacy - Women360" },
      { name: "page_location", type: "string", description: "Origin plus path, again without query or hash.", example: "https://women-360.vercel.app/privacy" },
    ],
  },
  {
    name: "nav_click",
    trigger: "A link or button inside a navigation area is clicked: the header, the footer, any <nav>, or anything marked data-nav.",
    how: "One delegated click listener on the document. It finds the nearest <a> or <button>, then the nearest <nav>, <header> or <footer>. Nothing in the markup needs changing.",
    params: [
      { name: "link_area", type: "string", description: "Which navigation: header, footer, nav or menu.", example: "header" },
      { name: "link_text", type: "string", description: "The visible text or accessible label, cut to 40 characters.", example: "Questions" },
      { name: "link_destination", type: "string", description: "Internal: the path or hash. External: the host only. Email: the word mailto, never the address.", example: "#questions" },
      { name: "link_type", type: "string", description: "internal, anchor, external, email or button.", example: "anchor" },
    ],
  },
  {
    name: "code_copy",
    trigger: "Text is copied from a code sample (<pre>, <code> or anything marked data-code-sample), by keyboard, menu or a copy button marked data-copy-code.",
    how: "The document's own copy event, filtered to selections inside a code element, plus a click listener for data-copy-code buttons. The copied text itself is never sent.",
    params: [
      { name: "code_language", type: "string", description: "From a language-xxx class or data-language, else unknown.", example: "tsx" },
      { name: "character_count", type: "number", description: "How many characters were copied.", example: 142 },
      { name: "copy_method", type: "string", description: "selection (copy command) or button.", example: "selection" },
    ],
  },
  {
    name: "filter_change",
    trigger: "A control marked data-track-filter changes (a select, checkbox, radio or toggle).",
    how: "Delegated change listener. Mark a control with data-track-filter=\"filter name\" and, optionally, data-track-list=\"list name\".",
    params: [
      { name: "filter_name", type: "string", description: "From data-track-filter.", example: "category" },
      { name: "filter_value", type: "string", description: "The chosen option, or on/off for a checkbox. Cut to 100 characters.", example: "forms" },
      { name: "list_name", type: "string", description: "From data-track-list, else none.", example: "components" },
    ],
  },
  {
    name: "site_search",
    trigger: "Someone types in a search box marked data-track-search and pauses (about 0.8 seconds, at least 2 characters).",
    how: "Delegated input listener with a debounce. It is not GA4's built-in search event, and it does not send the words typed, only how long they are.",
    params: [
      { name: "search_term_length", type: "number", description: "The number of characters typed. The text is never sent.", example: 7 },
      { name: "list_name", type: "string", description: "From data-track-list, else none.", example: "components" },
    ],
  },
  {
    name: "scroll_depth",
    trigger: "A long public page is scrolled to 25%, 50%, 75% or 100% of its height.",
    how: "A throttled scroll listener on pages at least 1.3 times taller than the window. Each depth is sent once per page view; moving to another page starts again.",
    params: [
      { name: "percent_scrolled", type: "number", description: "25, 50, 75 or 100.", example: 50 },
      { name: "page_path", type: "string", description: "The path only.", example: "/release-notes" },
    ],
  },
];

/** The pages that are reported, when analytics is on and the visitor agreed. Everything else (login, the whole signed-in app, admin, coach) never is. */
export const TRACKED_PATHS = ["/", "/privacy", "/terms", "/release-notes"];
/** The reference page shows events in its on-page log so they can be reviewed, but never sends them to Google. */
export const PREVIEW_PATH = "/analytics-reference";

export const SCROLL_DEPTHS = [25, 50, 75, 100] as const;

// ---- naming and value rules (also checked by the tests) ----

export const GA4_NAME_RULE = /^[a-z][a-z0-9_]{0,39}$/;
const RESERVED_PREFIXES = ["ga_", "google_", "firebase_"];
// Names GA4 collects itself (Enhanced measurement and the recommended set that overlaps what Women360 does).
const GA4_OWN_NAMES = ["click", "scroll", "search", "file_download", "form_start", "form_submit", "video_start", "video_progress", "video_complete", "view_search_results", "session_start", "first_visit", "user_engagement"];

export function isValidEventName(name: string): boolean {
  return GA4_NAME_RULE.test(name) && !RESERVED_PREFIXES.some((p) => name.startsWith(p)) && !GA4_OWN_NAMES.includes(name);
}
export function isValidParamName(name: string): boolean {
  return GA4_NAME_RULE.test(name) && !RESERVED_PREFIXES.some((p) => name.startsWith(p));
}

export function isTrackedPath(pathname: string): boolean {
  return TRACKED_PATHS.includes(pathname.replace(/\/+$/, "") || "/");
}

/** Plain text for a parameter: collapsed spaces, no line breaks, at most `max` characters. Anything that looks like an email address is dropped. */
export function cleanText(value: unknown, max = 100): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return "";
  return text.length > max ? text.slice(0, max) : text;
}

/** A path with no query string and no hash, for page_path. */
export function cleanPath(pathname: string): string {
  return (pathname.split("?")[0].split("#")[0] || "/").slice(0, 100);
}

/** Which of the depths have been passed, given how far down the page the bottom of the window is. */
export function depthsPassed(scrollTop: number, viewportHeight: number, documentHeight: number): number[] {
  if (documentHeight <= 0) return [];
  const percent = ((scrollTop + viewportHeight) / documentHeight) * 100;
  return SCROLL_DEPTHS.filter((d) => percent >= (d === 100 ? 99.5 : d));
}

/** Depth tracking only makes sense on a page that actually scrolls a fair way. */
export function isLongPage(viewportHeight: number, documentHeight: number): boolean {
  return documentHeight >= viewportHeight * 1.3;
}
