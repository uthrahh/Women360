import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { buildSummary } from "@/modules/chat/chat.summary";
import { buildSystemPrompt } from "@/modules/chat/chat.prompt";
import { runAnthropicChat, SUMMARY_TOOL, type ChatClient } from "@/modules/chat/chat.anthropic";
import type { ChatEvent } from "@/modules/chat/chat.events";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const TODAY = new Date().toISOString().slice(0, 10);
const saved: Record<string, string | undefined> = {};
const KEYS = ["CHATBOT_ENABLED", "CHATBOT_PROVIDER", "ANTHROPIC_API_KEY", "CHAT_SITE_PER_DAY", "NODE_ENV"];

function on(provider: "scripted" | "none" = "scripted") {
  process.env.CHATBOT_ENABLED = "true";
  if (provider === "scripted") process.env.CHATBOT_PROVIDER = "scripted";
  else delete process.env.CHATBOT_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
}

beforeAll(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
afterAll(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));
beforeEach(() => {
  delete process.env.CHAT_SITE_PER_DAY;
  process.env.NODE_ENV = saved.NODE_ENV;
  delete process.env.CHATBOT_ENABLED;
  delete process.env.CHATBOT_PROVIDER;
});

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Asha Verma",
    email: `chat.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: PASSWORD,
    dateOfBirth: "1990-05-15",
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string, email: res.body.data.user.email as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const ask = (token: string, text = "How is my sleep affecting my mood?") =>
  request(app).post("/api/v1/chat/message").set(auth(token)).send({ today: TODAY, messages: [{ role: "user", content: text }] });

function events(text: string): ChatEvent[] {
  return text
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as ChatEvent);
}
const answer = (evs: ChatEvent[]) => evs.filter((e): e is Extract<ChatEvent, { type: "delta" }> => e.type === "delta").map((e) => e.text).join("");

describe("the switch and who may use the chat", () => {
  it("does not exist while it is switched off", async () => {
    const { token } = await signUp("off");
    expect((await request(app).get("/api/v1/chat/status").set(auth(token))).status).toBe(404);
    expect((await ask(token)).status).toBe(404);
    expect((await request(app).get("/api/v1/config")).body.data.chatbot).toBe(false);
  });

  it("is announced to the web app only when switched on and able to answer", async () => {
    on("none");
    expect((await request(app).get("/api/v1/config")).body.data.chatbot).toBe(false); // on, but no key: nothing to answer with
    on("scripted");
    expect((await request(app).get("/api/v1/config")).body.data.chatbot).toBe(true);
  });

  it("needs a signed-in account, and is never open to the shared demo accounts", async () => {
    on();
    expect((await request(app).get("/api/v1/chat/status")).status).toBe(401);
    const { token, id } = await signUp("demo");
    await prisma.user.update({ where: { id }, data: { isDemo: true } });
    expect((await request(app).get("/api/v1/chat/status").set(auth(token))).status).toBe(403);
    expect((await ask(token)).status).toBe(403);
  });

  it("says plainly when it is switched on but has no key, and the scripted answers are refused in production", async () => {
    on("none");
    const { token } = await signUp("nokey");
    expect((await request(app).get("/api/v1/chat/status").set(auth(token))).body.data.configured).toBe(false);
    const res = await ask(token);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("CHAT_NOT_SET_UP");
    on("scripted");
    process.env.NODE_ENV = "production";
    expect((await ask(token)).status).toBe(503);
  });
});

describe("agreeing to share", () => {
  it("is off until she says so, and she can take it back", async () => {
    on();
    const { token } = await signUp("share");
    const status = () => request(app).get("/api/v1/chat/status").set(auth(token)).then((r) => r.body.data);
    expect((await status()).sharing).toBe(false);
    expect((await request(app).put("/api/v1/chat/sharing").set(auth(token)).send({ share: true })).body.data.sharing).toBe(true);
    expect((await status()).sharing).toBe(true);
    await request(app).put("/api/v1/chat/sharing").set(auth(token)).send({ share: false });
    expect((await status()).sharing).toBe(false);
    expect((await request(app).put("/api/v1/chat/sharing").set(auth(token)).send({ share: "yes" })).status).toBe(422);
  });

  it("decides whether the chat can read her summary, asked fresh on every question", async () => {
    on();
    const { token } = await signUp("sharing-read");
    const without = events((await ask(token)).text);
    expect(without.some((e) => e.type === "step" && /last 30 days/.test(e.label))).toBe(false);
    expect(answer(without)).toMatch(/haven't shared/);
    await request(app).put("/api/v1/chat/sharing").set(auth(token)).send({ share: true });
    const withIt = events((await ask(token)).text);
    expect(withIt.some((e) => e.type === "step" && /last 30 days/.test(e.label))).toBe(true);
    await request(app).put("/api/v1/chat/sharing").set(auth(token)).send({ share: false });
    expect(events((await ask(token)).text).some((e) => e.type === "step" && /last 30 days/.test(e.label))).toBe(false);
  });
});

describe("a question", () => {
  it("streams steps, the pages it saw, the answer and the follow-up line, then finishes", async () => {
    on();
    const { token } = await signUp("stream");
    const res = await ask(token);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    const evs = events(res.text);
    expect(evs[evs.length - 1]).toEqual({ type: "done" });
    expect(evs.find((e) => e.type === "sources")).toMatchObject({ sources: [{ url: "https://example.org/sleep-guide" }] });
    const text = answer(evs);
    expect(text).toContain("[Example sleep guide](https://example.org/sleep-guide)");
    expect(text).toMatch(/- \[ \] Wake at the same time/);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^>> .+ \| .+/);
  });

  it("is checked: nothing without her last message, nothing too long, nothing impossible", async () => {
    on();
    const { token } = await signUp("validate");
    const send = (body: unknown) => request(app).post("/api/v1/chat/message").set(auth(token)).send(body as object);
    expect((await send({ today: TODAY, messages: [] })).status).toBe(422);
    expect((await send({ today: TODAY, messages: [{ role: "assistant", content: "Hi" }] })).status).toBe(422);
    expect((await send({ today: TODAY, messages: [{ role: "user", content: "x".repeat(4001) }] })).status).toBe(422);
    expect((await send({ today: "not-a-day", messages: [{ role: "user", content: "Hi" }] })).status).toBe(422);
    expect((await send({ today: TODAY, messages: Array.from({ length: 21 }, () => ({ role: "user", content: "Hi" })) })).status).toBe(422);
    expect((await send({ today: "2099-01-01", messages: [{ role: "user", content: "Hi" }] })).status).toBe(400);
  });

  it("keeps no chat text: only who asked and when", async () => {
    on();
    const { token, id } = await signUp("keeps");
    await ask(token, "A very private question that must never be stored");
    const rows = await prisma.chatTurn.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["createdAt", "id", "userId"]);
    const exported = (await request(app).get("/api/v1/users/me/export").set(auth(token))).body;
    const dump = JSON.stringify(exported.data ?? exported);
    expect(dump).not.toContain("private question");
    expect((exported.data ?? exported).aiChat.recentQuestions).toHaveLength(1);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.chatTurn.count({ where: { userId: id } })).toBe(0);
  });

  it("is never kept as a save receipt, even if a client sends an Idempotency-Key", async () => {
    on();
    const { token, id } = await signUp("receipt");
    const key = `chat-receipt-${Date.now()}`;
    const send = () => request(app).post("/api/v1/chat/message").set(auth(token)).set("Idempotency-Key", key).send({ today: TODAY, messages: [{ role: "user", content: "Receipt check" }] });
    const first = await send();
    const second = await send();
    // Each is a real question (a stored copy would have replayed the first answer without asking again).
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await prisma.chatTurn.count({ where: { userId: id } })).toBe(2);
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(0);
  });
});

describe("limits", () => {
  it("stops one person after 40 in an hour, and after 150 in a day", async () => {
    on();
    const { token, id } = await signUp("limit-person");
    await prisma.chatTurn.createMany({ data: Array.from({ length: 40 }, () => ({ userId: id })) });
    const hour = await ask(token);
    expect(hour.status).toBe(429);
    expect(hour.body.error.message).toMatch(/this hour/);
    // Spread over the day instead: fine within the hour, but past the day's 150.
    await prisma.chatTurn.deleteMany({ where: { userId: id } });
    const earlier = new Date(Date.now() - 3 * 3_600_000);
    await prisma.chatTurn.createMany({ data: Array.from({ length: 150 }, () => ({ userId: id, createdAt: earlier })) });
    const day = await ask(token);
    expect(day.status).toBe(429);
    expect(day.body.error.message).toMatch(/today's/);
  });

  it("stops everyone when the site-wide day limit is reached, and counts nothing when it refuses", async () => {
    on();
    process.env.CHAT_SITE_PER_DAY = "1";
    const a = await signUp("limit-site-a");
    const b = await signUp("limit-site-b");
    const before = await prisma.chatTurn.count({ where: { userId: b.id } });
    const startingTotal = await prisma.chatTurn.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    // The site may already have turns from earlier tests today, so make the limit exactly what is used.
    process.env.CHAT_SITE_PER_DAY = String(startingTotal);
    const res = await ask(a.token);
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/very busy/);
    expect(await prisma.chatTurn.count({ where: { userId: b.id } })).toBe(before);
  });
});

describe("what the chat may read about her", () => {
  it("is numbers only: no name, email, notes or birth date", async () => {
    const { id, email } = await signUp("summary");
    const day = new Date(`${TODAY}T00:00:00Z`);
    await prisma.wellbeingEntry.create({ data: { userId: id, date: day, mood: 3, stress: null, energy: 2, note: "my secret note about my boss" } });
    const summary = await buildSummary(id, TODAY);
    const json = JSON.stringify(summary);
    for (const secret of [email, "Asha", "Verma", "1990", "secret note", "boss"]) expect(json).not.toContain(secret);
    expect(summary.ageBand).toBe(`${Math.floor((new Date().getUTCFullYear() - 1990) / 10) * 10}s`);
    expect(summary.daily.mood.whole).toEqual({ days: 1, average: 3 });
    // Nothing logged is null, never zero.
    expect(summary.daily.stress.whole).toEqual({ days: 0, average: null });
    expect(summary.daily.sleepHours.whole.average).toBeNull();
    expect(summary.window).toEqual({ days: 30, endsOn: TODAY });
  });
});

describe("the brief", () => {
  it("gives the date and whether it may read her data, and never her name", () => {
    const off = buildSystemPrompt({ today: "2026-11-18", sharing: false });
    const on_ = buildSystemPrompt({ today: "2026-11-18", sharing: true });
    expect(off).toContain("Today is 2026-11-18");
    expect(off).toMatch(/NOT agreed to share/);
    expect(on_).toMatch(new RegExp(SUMMARY_TOOL));
    expect(off + on_).not.toMatch(/Asha|Verma/);
  });

  it("carries the safety and sourcing rules", () => {
    const p = buildSystemPrompt({ today: "2026-11-18", sharing: false });
    for (const must of [/Never diagnose/, /Never tell her to start, stop or change a medicine/, /112/, /14416/, /Cite every claim/, /\(estimate\)/, /Never build, guess or shorten a link/, /not instructions/, /not birth control/, /last line, always: ">> "/]) {
      expect(p).toMatch(must);
    }
  });
});

describe("the model loop", () => {
  type Block = Record<string, unknown>;
  const stream = (events: unknown[], final: { stop_reason: string; content: Block[] }) => ({
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    finalMessage: async () => final,
  });

  function fake(rounds: ReturnType<typeof stream>[]) {
    const calls: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          stream(params: Record<string, unknown>) {
            calls.push(JSON.parse(JSON.stringify(params)));
            return rounds[calls.length - 1];
          },
        },
      },
    } as unknown as ChatClient;
    return { client, calls };
  }
  const collect = () => {
    const out: ChatEvent[] = [];
    return { out, emit: (e: ChatEvent) => void out.push(e) };
  };

  const searchRound = stream(
    [
      { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "srv1", name: "web_search", input: {} } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query":"sleep and' } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: ' mood"}' } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "srv1", content: [{ type: "web_search_result", url: "https://www.who.int/a", title: "WHO page" }, { type: "web_search_result", url: "http://insecure.example/b", title: "Insecure" }] } },
      { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "t1", name: SUMMARY_TOOL, input: {} } },
      { type: "content_block_stop", index: 2 },
    ],
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: SUMMARY_TOOL, input: {} }] }
  );
  const answerRound = stream(
    [
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Sleep matters [WHO page](https://www.who.int/a)." } },
    ],
    { stop_reason: "end_turn", content: [{ type: "text", text: "Sleep matters." }] }
  );

  it("reports each look-up as a step, keeps only https pages as sources, runs the summary tool and streams the text", async () => {
    const { client, calls } = fake([searchRound, answerRound]);
    const { out, emit } = collect();
    let summaryCalls = 0;
    await runAnthropicChat(client, {
      messages: [{ role: "user", content: "Why am I tired?" }],
      system: "SYSTEM",
      summary: async () => (summaryCalls++, { daily: { sleepHours: 6.4 } }),
      emit,
      signal: new AbortController().signal,
    });

    expect(summaryCalls).toBe(1);
    const steps = out.filter((e): e is Extract<ChatEvent, { type: "step" }> => e.type === "step");
    expect(steps.map((s) => `${s.state}:${s.label}`)).toEqual([
      "running:Searching the web",
      "running:Searching: sleep and mood",
      "done:Searched the web",
      "running:Reading your last 30 days",
      "done:Read your last 30 days",
    ]);
    expect(out.find((e) => e.type === "sources")).toEqual({ type: "sources", sources: [{ url: "https://www.who.int/a", title: "WHO page" }] });
    expect(answer(out)).toBe("Sleep matters [WHO page](https://www.who.int/a).");
    expect(out[out.length - 1]).toEqual({ type: "done" });

    // The request: the brief, the tools with their limits, the fallback, and medium effort.
    expect(calls).toHaveLength(2);
    const first = calls[0] as { model: string; system: string; betas: string[]; fallbacks: string; output_config: { effort: string }; tools: { name: string; type?: string; max_uses?: number }[]; max_tokens: number };
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.system).toBe("SYSTEM");
    expect(first.betas).toContain("server-side-fallback-2026-07-01");
    expect(first.fallbacks).toBe("default");
    expect(first.output_config.effort).toBe("medium");
    expect(first.max_tokens).toBe(8000);
    expect(first.tools.find((t) => t.name === "web_search")).toMatchObject({ type: "web_search_20260209", max_uses: 4 });
    expect(first.tools.find((t) => t.name === "web_fetch")).toMatchObject({ type: "web_fetch_20260209", max_uses: 3 });
    expect(first.tools.map((t) => t.name)).toContain(SUMMARY_TOOL);
    // The second request carries the tool's result back.
    const second = calls[1] as { messages: { role: string; content: unknown }[] };
    expect(JSON.stringify(second.messages[second.messages.length - 1])).toContain('"tool_use_id":"t1"');
    expect(JSON.stringify(second.messages[second.messages.length - 1])).toContain("sleepHours");
  });

  it("offers no summary tool when she has not agreed to share", async () => {
    const { client, calls } = fake([answerRound]);
    const { emit } = collect();
    await runAnthropicChat(client, { messages: [{ role: "user", content: "Hi" }], system: "S", summary: null, emit, signal: new AbortController().signal });
    expect((calls[0] as { tools: { name: string }[] }).tools.map((t) => t.name)).not.toContain(SUMMARY_TOOL);
  });

  it("carries on after a paused look-up, and stops with a plain message on a refusal", async () => {
    const paused = stream([], { stop_reason: "pause_turn", content: [{ type: "text", text: "..." }] });
    const { client, calls } = fake([paused, answerRound]);
    const a = collect();
    await runAnthropicChat(client, { messages: [{ role: "user", content: "Hi" }], system: "S", summary: null, emit: a.emit, signal: new AbortController().signal });
    expect(calls).toHaveLength(2);
    expect(answer(a.out)).toContain("Sleep matters");

    const refused = fake([stream([], { stop_reason: "refusal", content: [] })]);
    const b = collect();
    await runAnthropicChat(refused.client, { messages: [{ role: "user", content: "Hi" }], system: "S", summary: null, emit: b.emit, signal: new AbortController().signal });
    expect(b.out).toEqual([{ type: "error", message: "I can't help with that one." }]);
  });

  it("gives up looking things up after six rounds instead of looping", async () => {
    const forever = Array.from({ length: 8 }, () => stream([], { stop_reason: "pause_turn", content: [{ type: "text", text: "." }] }));
    const { client, calls } = fake(forever);
    const { out, emit } = collect();
    await runAnthropicChat(client, { messages: [{ role: "user", content: "Hi" }], system: "S", summary: null, emit, signal: new AbortController().signal });
    expect(calls).toHaveLength(6);
    expect(out[out.length - 1]).toEqual({ type: "done" });
  });
});
