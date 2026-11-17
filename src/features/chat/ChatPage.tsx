import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowUp, Plus, Square } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useFeatures } from "@/context/FeaturesContext";
import { ApiError } from "@/services/apiClient";
import { chatService, streamChat, type ChatEvent, type ChatStatus, type ChatTurn } from "@/services/chatService";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { ChatAnswer, type ChatMsg } from "./ChatAnswer";
import { ChatShader } from "./ChatShader";
import "./chat.css";

const MAX_LENGTH = 4000;
/** The server accepts 20 messages in a conversation; older ones drop off the front. */
const MAX_TURNS = 20;

/**
 * The conversation lives here, in memory, and nowhere else: it survives a trip to another screen and back (the plan links to them),
 * and goes when the tab is closed, when she starts a new chat, or when she signs out. Women360's server keeps none of it.
 */
let memory: { userId: string; msgs: ChatMsg[] } | null = null;
if (typeof window !== "undefined") window.addEventListener("w360:session-expired", () => (memory = null));

const uid = () => Math.random().toString(36).slice(2, 10);

const PROMPTS_WITH_LOGS = ["What do my last 30 days say?", "What should I ask at my next check-up?", "Help me sleep more regularly", "How could I build a walking habit?"];
const PROMPTS_WITHOUT_LOGS = ["What should I ask at my next check-up?", "Help me sleep more regularly", "How could I build a walking habit?", "What does stress do to my body?"];

/** Not reachable unless the owner has switched the chat on: the address goes home, like Learn. */
export default function ChatPage() {
  const { chatbot, loaded } = useFeatures();
  if (!loaded) return null;
  if (!chatbot) return <Navigate to="/app/dashboard" replace />;
  return <ChatScreen />;
}

function ChatScreen() {
  const { auth, senior } = useApp();
  const userId = auth.user?.id ?? "";
  const toast = useToast();
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => (memory && memory.userId === userId ? memory.msgs.map((m) => ({ ...m, live: false })) : []));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const load = useCallback(() => {
    setFailed(false);
    chatService
      .status()
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // Remember the conversation for a trip to another screen; stop any answer still arriving if she leaves.
  useEffect(() => {
    memory = { userId, msgs };
  }, [userId, msgs]);
  useEffect(() => () => abort.current?.abort(), []);

  // Keep the newest words in view while she is reading along, but never drag her down if she has scrolled up to re-read.
  useEffect(() => {
    const onScroll = () => {
      stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  const patchLast = (fn: (m: ChatMsg) => ChatMsg) =>
    setMsgs((list) => {
      if (list.length === 0) return list;
      const copy = list.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  const apply = (e: ChatEvent) => {
    patchLast((m) => {
      switch (e.type) {
        case "step": {
          const i = m.steps.findIndex((s) => s.id === e.id);
          const steps = i === -1 ? [...m.steps, { id: e.id, label: e.label, state: e.state }] : m.steps.map((s, j) => (j === i ? { ...s, label: e.label, state: e.state } : s));
          return { ...m, steps };
        }
        case "sources":
          return { ...m, sources: [...m.sources, ...e.sources.filter((s) => !m.sources.some((x) => x.url === s.url))] };
        case "delta":
          return { ...m, text: m.text + e.text };
        case "done":
          return { ...m, done: true, steps: m.steps.map((s) => ({ ...s, state: "done" as const })) };
        case "error":
          return { ...m, done: true, error: e.message, steps: m.steps.map((s) => ({ ...s, state: "done" as const })) };
      }
    });
  };

  /** Sends the question after `history` (what has been said so far). */
  const ask = async (question: string, history: ChatMsg[]) => {
    const asked: ChatMsg = { id: uid(), role: "user", text: question, steps: [], sources: [], done: true, ticks: [], live: false };
    const answer: ChatMsg = { id: uid(), role: "assistant", text: "", steps: [], sources: [], done: false, ticks: [], live: !reducedMotion };
    const next = [...history, asked, answer];
    setMsgs(next);
    setBusy(true);
    stick.current = true;
    const turns: ChatTurn[] = [...history, asked]
      .filter((m) => m.text.trim() !== "" && !m.error)
      .map((m) => ({ role: m.role, content: m.text }))
      .slice(-MAX_TURNS);
    // The conversation must begin with her: if the oldest kept message is an answer, drop it.
    while (turns.length > 1 && turns[0].role !== "user") turns.shift();

    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamChat(turns, apply, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        patchLast((m) => ({ ...m, done: true, steps: m.steps.map((s) => ({ ...s, state: "done" as const })) }));
      } else {
        const message = err instanceof ApiError && err.status !== 0 ? err.message : "I couldn't reach the chat. Check your connection and try again.";
        apply({ type: "error", message });
      }
    } finally {
      setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  };

  const send = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    if (question.length > MAX_LENGTH) {
      toast.show(`That message is too long. Keep it under ${MAX_LENGTH.toLocaleString()} characters.`, { tone: "error" });
      return;
    }
    setDraft("");
    void ask(question, msgs);
  };

  const retry = () => {
    // Re-ask the last question: drop the failed answer and the question, then send it again.
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser || busy) return;
    const upto = msgs.lastIndexOf(lastUser);
    void ask(lastUser.text, msgs.slice(0, upto));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const stop = () => abort.current?.abort();
  const reset = () => {
    abort.current?.abort();
    memory = null;
    setMsgs([]);
    setBusy(false);
    stick.current = true;
    window.scrollTo({ top: 0 });
    input.current?.focus();
  };

  const tick = (id: string, n: number) => setMsgs((list) => list.map((m) => (m.id === id ? { ...m, ticks: m.ticks.includes(n) ? m.ticks.filter((t) => t !== n) : [...m.ticks, n] } : m)));

  const toggleSharing = async () => {
    if (!status) return;
    const share = !status.sharing;
    setStatus({ ...status, sharing: share });
    try {
      await chatService.setSharing(share);
    } catch {
      setStatus((s) => (s ? { ...s, sharing: !share } : s));
      toast.show("That didn't save. Please try again.", { tone: "error" });
    }
  };

  if (failed) return <ErrorState title="Couldn't open the chat" onRetry={load} />;
  if (!status) return <LoadingState label="Opening the chat" />;
  if (!status.configured) return <ErrorState title="The chat isn't available right now" description="Please try again later." onRetry={load} />;

  const empty = msgs.length === 0;
  const prompts = status.sharing ? PROMPTS_WITH_LOGS : PROMPTS_WITHOUT_LOGS;

  return (
    <div className="w360-chat" data-empty={empty} data-testid="chat">
      <div className="w360-chat-sky" aria-hidden>
        <ChatShader still={reducedMotion || senior.seniorMode} />
      </div>
      <div className="w360-chat-veil" aria-hidden />

      <div className="px-4 sm:px-8 pt-6 pb-4 min-h-[calc(100dvh-9rem)] flex flex-col">
        <header className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl sm:text-3xl leading-tight">Ask Women360</h1>
          {!empty && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chat-line)] px-3.5 py-1.5 text-sm hover:bg-[var(--chat-surface-hover)] transition-[background-color,transform] duration-hover active:scale-[0.97] shrink-0">
              <Plus size={15} aria-hidden /> New chat
            </button>
          )}
        </header>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--chat-line)] bg-[var(--chat-surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium" id="chat-share-label">Let the chat read a summary of my last 30 days</p>
            <p className="text-xs text-[var(--chat-muted)] mt-0.5">
              {status.sharing
                ? "On: it can read averages and counts (sleep, mood, energy, activity, water, cycle phase, habits). Never names, notes or medicines."
                : "Off: it can't see anything you've logged. Turn it on for answers about your own numbers."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={status.sharing}
            aria-labelledby="chat-share-label"
            onClick={toggleSharing}
            className={`w-11 h-6 rounded-full relative transition-colors duration-hover shrink-0 ${status.sharing ? "bg-[var(--chat-orange)]" : "bg-white/25"}`}
          >
            <span className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-popover ease-overshoot ${status.sharing ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="flex-1 mt-6" role="log" aria-label="Conversation">
          {empty ? (
            <div className="max-w-xl pt-4 sm:pt-10">
              <p className="font-display text-xl sm:text-2xl leading-snug">What would you like to understand about your health?</p>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {prompts.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => send(p)} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--chat-on-light)] text-left transition-[background-color,transform] duration-hover hover:bg-[var(--chat-link)] active:scale-[0.97]">
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-7">
              {msgs.map((m, i) => (
                <li key={m.id}>
                  {m.role === "user" ? (
                    <div className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[var(--chat-on-light)]">
                        <span className="sr-only">You: </span>
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-2xl">
                      <p className="sr-only">Women360: </p>
                      <ChatAnswer msg={m} onTick={(n) => tick(m.id, n)} onAsk={send} onRetry={retry} canRetry={i === msgs.length - 1 && !busy} latest={i === msgs.length - 1} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="w360-chat-composer mt-6 pt-2">
          <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-[var(--chat-line)] bg-[var(--chat-bg-deep)] p-2 pl-4 transition-colors duration-hover focus-within:border-white">
            <label htmlFor="chat-input" className="sr-only">Ask a question</label>
            <textarea
              id="chat-input"
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              maxLength={MAX_LENGTH + 200}
              placeholder="Ask about your health, habits or check-ups"
              className="flex-1 resize-none bg-transparent py-2 text-base text-[var(--chat-text)] placeholder:text-[var(--chat-muted)] outline-none max-h-40 [field-sizing:content]"
            />
            {busy ? (
              <button type="button" onClick={stop} aria-label="Stop answering" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--chat-on-light)] transition-transform duration-press active:scale-[0.94]">
                <Square size={14} fill="currentColor" aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={draft.trim() === ""} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--chat-on-light)] transition-[transform,opacity] duration-press active:scale-[0.94] disabled:opacity-40">
                <ArrowUp size={18} aria-hidden />
              </button>
            )}
          </form>
          <p className="mt-2 text-xs text-[var(--chat-muted)]">
            Not medical advice: it can be wrong, so check anything important with a doctor. In an emergency, call your local emergency number. This conversation isn't saved; it's gone when you close the tab.
          </p>
        </div>
        {/* The end of the page: new words scroll here, below the box she types in, so nothing is hidden behind it. */}
        <div ref={bottom} />
      </div>
    </div>
  );
}
