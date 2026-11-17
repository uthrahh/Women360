import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaRawMessageStreamEvent,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
  MessageCreateParamsStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { CHAT_MAX_TOKENS, MAX_FETCHES, MAX_ROUNDS, MAX_SEARCHES, chatEffort, chatModel } from "./chat.config";
import type { ChatRun } from "./chat.events";

type StreamEvent = BetaRawMessageStreamEvent;
type Message = BetaMessage;

/** The part of the SDK this file uses, so a test can stand in for it without a key or a network. */
export interface ChatClient {
  beta: {
    messages: {
      stream(params: MessageCreateParamsStreaming | Record<string, unknown>, options?: { signal?: AbortSignal }): AsyncIterable<StreamEvent> & { finalMessage(): Promise<Message> };
    };
  };
}

export const SUMMARY_TOOL = "get_my_summary";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
}

/**
 * Answers one question with Claude, streaming. Web search and web fetch run on Anthropic's side; the one tool that runs here reads the
 * numbers-only summary of her own logs, and only exists when she agreed to share. What happens is reported as events: a step for each
 * look-up, the pages actually seen (the only links the screen will show as sources), and the answer text as it arrives.
 */
export async function runAnthropicChat(client: ChatClient, run: ChatRun): Promise<void> {
  const { emit, signal } = run;
  const tools: BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES },
  ];
  if (run.summary) {
    tools.push({
      name: SUMMARY_TOOL,
      description: "Read a numbers-only summary of the user's own logs for the last 30 days (averages of sleep, mood, energy, stress, activity, water, caffeine, alcohol, cycle phase and habit counts). No names, notes or medicines. Takes no input.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      strict: true,
    });
  }

  const convo: BetaMessageParam[] = run.messages.map((m) => ({ role: m.role, content: m.content }));
  const seen = new Map<string, string>();
  const announceSources = (found: { url: string; title: string }[]) => {
    const fresh = found.filter((s) => /^https:\/\//.test(s.url) && !seen.has(s.url));
    for (const s of fresh) seen.set(s.url, s.title);
    if (fresh.length) emit({ type: "sources", sources: fresh });
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = client.beta.messages.stream(
      {
        model: chatModel(),
        max_tokens: CHAT_MAX_TOKENS,
        // If the model declines a request on safety grounds, the API retries it on the fallback model within the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: chatEffort() },
        system: run.system,
        tools,
        messages: convo,
      } as MessageCreateParamsStreaming,
      { signal }
    );

    // Blocks being written, by index, so a tool's input (which arrives in pieces) can be read when its block closes.
    const open = new Map<number, { id: string; name: string; json: string }>();
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const b = event.content_block;
        if (b.type === "server_tool_use" && (b.name === "web_search" || b.name === "web_fetch")) {
          open.set(event.index, { id: b.id, name: b.name, json: "" });
          emit({ type: "step", id: b.id, label: b.name === "web_search" ? "Searching the web" : "Reading a page", state: "running" });
        } else if (b.type === "tool_use" && b.name === SUMMARY_TOOL) {
          emit({ type: "step", id: b.id, label: "Reading your last 30 days", state: "running" });
        } else if (b.type === "web_search_tool_result") {
          if (Array.isArray(b.content)) announceSources(b.content.map((r) => ({ url: r.url, title: r.title })));
          emit({ type: "step", id: b.tool_use_id, label: "Searched the web", state: "done" });
        } else if (b.type === "web_fetch_tool_result") {
          const c = b.content;
          if (c.type === "web_fetch_result") announceSources([{ url: c.url, title: host(c.url) }]);
          emit({ type: "step", id: b.tool_use_id, label: c.type === "web_fetch_result" ? `Read ${host(c.url)}` : "Couldn't read that page", state: "done" });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") emit({ type: "delta", text: event.delta.text });
        else if (event.delta.type === "input_json_delta") {
          const o = open.get(event.index);
          if (o) o.json += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        const o = open.get(event.index);
        if (o) {
          open.delete(event.index);
          try {
            const input = JSON.parse(o.json || "{}") as { query?: unknown; url?: unknown };
            if (o.name === "web_search" && typeof input.query === "string") emit({ type: "step", id: o.id, label: `Searching: ${input.query.slice(0, 80)}`, state: "running" });
            if (o.name === "web_fetch" && typeof input.url === "string") emit({ type: "step", id: o.id, label: `Reading ${host(input.url)}`, state: "running" });
          } catch {
            /* the step keeps its general label */
          }
        }
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "I can't help with that one." });
      return;
    }
    convo.push({ role: "assistant", content: message.content as BetaContentBlockParam[] });

    // A long look-up paused by the server: send it back so it carries on.
    if (message.stop_reason === "pause_turn") continue;

    if (message.stop_reason === "tool_use") {
      const calls = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      const results: BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        if (call.name === SUMMARY_TOOL && run.summary) {
          try {
            results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(await run.summary()) });
            emit({ type: "step", id: call.id, label: "Read your last 30 days", state: "done" });
          } catch {
            results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: "The summary could not be read." });
            emit({ type: "step", id: call.id, label: "Couldn't read your last 30 days", state: "done" });
          }
        } else {
          results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: "Unknown tool." });
        }
      }
      convo.push({ role: "user", content: results });
      continue;
    }
    break;
  }
  emit({ type: "done" });
}
