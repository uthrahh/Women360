/**
 * Turns the chat's streamed text into blocks the screen can lay out. The chat writes a small, fixed subset of Markdown (paragraphs,
 * `##` headings, `-` lists, `- [ ]` tasks, **bold**, `code`, links) and ends with one line of follow-up questions: `>> a | b | c`.
 * Nothing here ever produces HTML: the result is plain data, and the screen builds elements from it.
 *
 * A block is "complete" once the text after it shows it has ended (a blank line, or a different kind of line), or when the stream is over.
 * The screen shows only complete blocks, so a paragraph's space is laid out whole before its words fade in, and the page doesn't jump.
 */

export type Inline =
  | { t: "text"; text: string }
  | { t: "bold"; children: Inline[] }
  | { t: "code"; text: string }
  /** A page the chat actually looked at (its address was announced by the server as a source). */
  | { t: "source"; text: string; href: string }
  /** A screen inside Women360. */
  | { t: "internal"; text: string; to: string };

export type Block =
  | { type: "p"; inlines: Inline[] }
  | { type: "h"; inlines: Inline[] }
  | { type: "list"; items: { inlines: Inline[]; task: boolean }[] };

export interface ParsedChat {
  /** Finished blocks, in order. */
  blocks: Block[];
  /** True while a block is still being written (the screen shows a placeholder for it). */
  pending: boolean;
  /** Up to three questions she could ask next; empty until the closing `>>` line has fully arrived. */
  followUps: string[];
}

const INTERNAL = /^\/app\/[a-z-]+(\?[A-Za-z0-9=&_-]*)?$/;
const MAX_FOLLOW_UPS = 3;
const MAX_FOLLOW_UP_LENGTH = 120;

/** The same page with and without a trailing slash or a fragment counts as the same source. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Inline formatting. A link only becomes a link if it is a screen of ours or a page the server announced; otherwise only its words stay. */
export function parseInline(text: string, sources: ReadonlySet<string>): Inline[] {
  const out: Inline[] = [];
  const push = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.t === "text") last.text += t;
    else out.push({ t: "text", text: t });
  };
  // Order matters: a link's text may hold bold, and bold may not hold a link, which keeps this a single pass.
  const token = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  for (let m = token.exec(text); m; m = token.exec(text)) {
    push(text.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[1] !== undefined) out.push({ t: "bold", children: [{ t: "text", text: m[1] }] });
    else if (m[2] !== undefined) out.push({ t: "code", text: m[2] });
    else {
      const label = m[3];
      const href = m[4];
      if (INTERNAL.test(href)) out.push({ t: "internal", text: label, to: href });
      else if (/^https:\/\//.test(href) && sources.has(normalizeUrl(href))) out.push({ t: "source", text: label, href });
      else push(label);
    }
  }
  push(text.slice(at));
  return out;
}

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;
const TASK = /^\[( |x|X)\]\s+(.*)$/;
const HEADING = /^#{1,4}\s+(.*)$/;

/** The follow-up line, if the text ends with one. */
function splitFollowUps(text: string): { body: string; line: string | null; lineDone: boolean } {
  const lines = text.split("\n");
  // The last line with anything on it. A blank tail (the stream paused between lines) doesn't hide it.
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0 || !lines[i].trimStart().startsWith(">>")) return { body: text, line: null, lineDone: false };
  const line = lines[i].trimStart().slice(2);
  return { body: lines.slice(0, i).join("\n"), line, lineDone: i < lines.length - 1 };
}

export function parseFollowUps(line: string): string[] {
  return line
    .split("|")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.length <= MAX_FOLLOW_UP_LENGTH)
    .slice(0, MAX_FOLLOW_UPS);
}

export function parseChat(text: string, opts: { done: boolean; sources: ReadonlySet<string> }): ParsedChat {
  const { body, line, lineDone } = splitFollowUps(text);
  // The chat writes the follow-up line only after its last block, so that block is finished once the line has started.
  const lines = (line !== null ? `${body}\n\n` : body).split("\n");
  type Raw = { kind: "p" | "h" | "list"; lines: string[]; ended: boolean };
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  const close = () => {
    if (cur) {
      cur.ended = true;
      raws.push(cur);
      cur = null;
    }
  };
  lines.forEach((raw, idx) => {
    if (raw.trim() === "") return close();
    const heading = HEADING.exec(raw);
    if (heading) {
      close();
      // A heading is whole once its line has ended (something follows it), or the stream is over.
      raws.push({ kind: "h", lines: [heading[1]], ended: idx < lines.length - 1 || opts.done });
      return;
    }
    const item = LIST_ITEM.exec(raw);
    if (item) {
      if (cur && cur.kind !== "list") close();
      cur ??= { kind: "list", lines: [], ended: false };
      cur.lines.push(item[1]);
      return;
    }
    if (cur && cur.kind === "list") close();
    cur ??= { kind: "p", lines: [], ended: false };
    cur.lines.push(raw.trim());
  });
  // The block still open at the end is finished only if the stream is over.
  if (cur) {
    const open: Raw = cur;
    open.ended = opts.done;
    raws.push(open);
  }

  const blocks: Block[] = [];
  let pending = false;
  for (const b of raws) {
    if (!b.ended) {
      pending = true;
      continue;
    }
    if (b.kind === "p") blocks.push({ type: "p", inlines: parseInline(b.lines.join(" "), opts.sources) });
    else if (b.kind === "h") blocks.push({ type: "h", inlines: parseInline(b.lines[0], opts.sources) });
    else
      blocks.push({
        type: "list",
        items: b.lines.map((l) => {
          const task = TASK.exec(l);
          return { inlines: parseInline(task ? task[2] : l, opts.sources), task: task !== null };
        }),
      });
  }

  // The follow-ups appear once the line is whole: the stream is over, or a newline followed it.
  const followUps = line !== null && (opts.done || lineDone) ? parseFollowUps(line) : [];
  return { blocks, pending, followUps };
}

/** Plain text of some inline pieces, for a copy button and for screen-reader labels. */
export function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => (i.t === "bold" ? inlineText(i.children) : i.text)).join("");
}

/** Every task in the answer in order, so each has a stable number to remember a tick under. */
export function countTasks(blocks: Block[]): number {
  return blocks.reduce((n, b) => n + (b.type === "list" ? b.items.filter((i) => i.task).length : 0), 0);
}
