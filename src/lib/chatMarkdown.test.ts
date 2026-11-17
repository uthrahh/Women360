import { describe, expect, it } from "vitest";
import { countTasks, inlineText, normalizeUrl, parseChat, parseFollowUps, parseInline } from "./chatMarkdown";

const none = new Set<string>();
const seen = new Set([normalizeUrl("https://example.org/sleep-guide")]);

describe("parseInline", () => {
  it("keeps plain text, bold and code", () => {
    expect(parseInline("a **b** `c`", none)).toEqual([
      { t: "text", text: "a " },
      { t: "bold", children: [{ t: "text", text: "b" }] },
      { t: "text", text: " " },
      { t: "code", text: "c" },
    ]);
  });

  it("links a page only if the server announced it", () => {
    const linked = parseInline("see [guide](https://example.org/sleep-guide)", seen);
    expect(linked[1]).toEqual({ t: "source", text: "guide", href: "https://example.org/sleep-guide" });
    // An address the chat made up keeps its words and loses the link.
    expect(parseInline("see [guide](https://invented.example/x)", seen)).toEqual([{ t: "text", text: "see guide" }]);
  });

  it("matches a source with or without a trailing slash or a fragment", () => {
    const set = new Set([normalizeUrl("https://example.org/a/")]);
    expect(parseInline("[x](https://example.org/a#top)", set)[0].t).toBe("source");
  });

  it("never links http, javascript or data addresses", () => {
    const set = new Set([normalizeUrl("http://example.org/a")]);
    expect(parseInline("[x](http://example.org/a)", set)).toEqual([{ t: "text", text: "x" }]);
    // (Nested brackets leave a stray ")" behind; what matters is that no link is made.)
    expect(parseInline("[x](javascript:alert(1))", seen).every((i) => i.t === "text")).toBe(true);
    expect(parseInline("[x](data:text/html,hi)", seen)).toEqual([{ t: "text", text: "x" }]);
  });

  it("links only to real screens inside the app", () => {
    expect(parseInline("[Sleep](/app/sleep)", none)[0]).toEqual({ t: "internal", text: "Sleep", to: "/app/sleep" });
    expect(parseInline("[Habits](/app/health?tab=medicines)", none)[0].t).toBe("internal");
    expect(parseInline("[x](//evil.example/app/sleep)", none)).toEqual([{ t: "text", text: "x" }]);
    expect(parseInline("[x](/admin/users)", none)).toEqual([{ t: "text", text: "x" }]);
  });

  it("does not turn markup into elements", () => {
    const out = parseInline("<img src=x onerror=alert(1)> hi", none);
    expect(out).toEqual([{ t: "text", text: "<img src=x onerror=alert(1)> hi" }]);
  });
});

describe("parseFollowUps", () => {
  it("splits on the bar, trims, caps at three and drops over-long ones", () => {
    expect(parseFollowUps(" a | b |  | c | d ")).toEqual(["a", "b", "c"]);
    expect(parseFollowUps(`ok | ${"x".repeat(200)}`)).toEqual(["ok"]);
  });
});

describe("parseChat", () => {
  const text = "First paragraph.\n\nSecond paragraph.\n\n- [ ] one\n- [x] two\n\n>> Why? | Then what?";

  it("shows only finished blocks while streaming and holds back the one still being written", () => {
    const mid = parseChat("First paragraph.\n\nSecond par", { done: false, sources: none });
    expect(mid.blocks).toHaveLength(1);
    expect(mid.pending).toBe(true);
    expect(mid.followUps).toEqual([]);
  });

  it("finishes the last block when the stream is over", () => {
    const end = parseChat("First paragraph.\n\nSecond par", { done: true, sources: none });
    expect(end.blocks).toHaveLength(2);
    expect(end.pending).toBe(false);
  });

  it("reads tasks and follow-ups from a whole answer", () => {
    const r = parseChat(text, { done: true, sources: none });
    expect(r.blocks.map((b) => b.type)).toEqual(["p", "p", "list"]);
    const list = r.blocks[2];
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.items.map((i) => i.task)).toEqual([true, true]);
    expect(list.items.map((i) => inlineText(i.inlines))).toEqual(["one", "two"]);
    expect(countTasks(r.blocks)).toBe(2);
    expect(r.followUps).toEqual(["Why?", "Then what?"]);
  });

  it("never shows the follow-up line as text, even before it is whole", () => {
    const r = parseChat("A paragraph.\n\n>> Why does it", { done: false, sources: none });
    expect(r.blocks).toHaveLength(1);
    expect(r.followUps).toEqual([]);
    const whole = parseChat("A paragraph.\n\n>> Why does it | Next?\n", { done: false, sources: none });
    expect(whole.followUps).toEqual(["Why does it", "Next?"]);
  });

  it("treats a list written straight after a sentence as its own block", () => {
    const r = parseChat("Try this:\n- [ ] a\n- [ ] b\n\n", { done: false, sources: none });
    expect(r.blocks.map((b) => b.type)).toEqual(["p", "list"]);
  });

  it("reads headings and waits for the line to end", () => {
    expect(parseChat("## Plan", { done: false, sources: none }).blocks).toHaveLength(0);
    expect(parseChat("## Plan\n", { done: false, sources: none }).blocks[0].type).toBe("h");
  });

  it("an empty answer is empty", () => {
    expect(parseChat("", { done: false, sources: none })).toEqual({ blocks: [], pending: false, followUps: [] });
  });
});
