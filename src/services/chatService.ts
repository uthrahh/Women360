import { ApiError, request, requestStream } from "./apiClient";
import { localDateISO } from "./mappers";

/** What the server streams, one JSON object per event (mirrors server/src/modules/chat/chat.events.ts). */
export type ChatEvent =
  | { type: "step"; id: string; label: string; state: "running" | "done" }
  | { type: "sources"; sources: { url: string; title: string }[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatStatus {
  configured: boolean;
  /** Whether she has agreed to let the chat read a numbers-only summary of her last 30 days. */
  sharing: boolean;
  limits: { perHour: number; perDay: number };
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const chatService = {
  status: () => request<ChatStatus>("/chat/status"),
  setSharing: (share: boolean) => request<{ sharing: boolean }>("/chat/sharing", { method: "PUT", body: JSON.stringify({ share }) }),
};

/** Pulls whole events out of what has arrived so far; returns what is left over (an event cut in half). */
export function takeEvents(buffer: string): { events: ChatEvent[]; rest: string } {
  const events: ChatEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    for (const line of part.split("\n")) {
      // ": keep-alive" comments and anything that isn't data are ignored.
      if (!line.startsWith("data:")) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as ChatEvent;
        if (event && typeof event.type === "string") events.push(event);
      } catch {
        /* a malformed event is skipped, never shown */
      }
    }
  }
  return { events, rest };
}

/**
 * Asks one question and calls `onEvent` for each thing that happens, until the answer is complete.
 * The conversation lives only in her browser tab and is sent whole each time; the server keeps none of it.
 * Rejects with an ApiError for a refusal before the answer starts (the limit, the chat being switched off, a bad session).
 */
export async function streamChat(messages: ChatTurn[], onEvent: (e: ChatEvent) => void, signal: AbortSignal): Promise<void> {
  const res = await requestStream("/chat/message", { today: localDateISO(), messages }, signal);
  if (!res.body) throw new ApiError("The chat couldn't answer just now. Please try again in a moment.", 502);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  const handle = (e: ChatEvent) => {
    if (e.type === "done" || e.type === "error") finished = true;
    onEvent(e);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = takeEvents(buffer);
    buffer = rest;
    events.forEach(handle);
  }
  // The connection ended without a closing event (a dropped network): say so rather than leave the answer looking finished.
  if (!finished) onEvent({ type: "error", message: "The connection dropped before the answer finished. Please try again." });
}
