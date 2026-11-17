/** What the server streams to the chat screen, one JSON object per server-sent event. */
export type ChatEvent =
  /** Something the chat is doing right now ("Reading your last 30 days", "Searching: ..."); sent again with the same id when it finishes. */
  | { type: "step"; id: string; label: string; state: "running" | "done" }
  /** Pages the chat actually saw in a search or a lookup. Only these links are shown as sources. */
  | { type: "sources"; sources: { url: string; title: string }[] }
  /** A piece of the answer text. */
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatTurnMessage = { role: "user" | "assistant"; content: string };

export interface ChatRun {
  messages: ChatTurnMessage[];
  system: string;
  /** Present only when she has agreed to share: reads a numbers-only summary of her last 30 days. */
  summary: (() => Promise<unknown>) | null;
  emit: (event: ChatEvent) => void;
  signal: AbortSignal;
}
