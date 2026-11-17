import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { countTasks, normalizeUrl, parseChat, type Block, type Inline } from "@/lib/chatMarkdown";

export interface ChatStep {
  id: string;
  label: string;
  state: "running" | "done";
}
export interface ChatSource {
  url: string;
  title: string;
}
export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: ChatStep[];
  sources: ChatSource[];
  /** The stream has ended (finished, stopped or failed). */
  done: boolean;
  error?: string;
  /** Which of the plan's tasks she has ticked (by their order in the answer). */
  ticks: number[];
  /** Streamed in during this visit: its words fade in. An answer shown again from memory appears at once. */
  live: boolean;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Words, each its own inline span (read aloud as ordinary running text) with a small stagger so a paragraph fades in rather than appears. */
function renderText(text: string, live: boolean, counter: { n: number }): ReactNode {
  if (!live) return text;
  return text.split(/(\s+)/).map((part, i) => {
    if (part === "" || /^\s+$/.test(part)) return part;
    const delay = Math.min(counter.n++ * 14, 650);
    return (
      <span key={i} className="w360-chat-word" style={{ "--d": `${delay}ms` } as CSSProperties}>
        {part}
      </span>
    );
  });
}

function Inlines({ inlines, live, counter }: { inlines: Inline[]; live: boolean; counter: { n: number } }) {
  return (
    <>
      {inlines.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{renderText(n.text, live, counter)}</Fragment>;
          case "bold":
            return (
              <strong key={i} className="font-semibold">
                <Inlines inlines={n.children} live={live} counter={counter} />
              </strong>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-white/15 px-1 py-0.5 text-[0.92em]">
                {n.text}
              </code>
            );
          case "source":
            // A page the chat actually read. It opens elsewhere and sends nothing about where she came from.
            return (
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="text-[var(--chat-link)] underline underline-offset-2 hover:text-white">
                {renderText(n.text, live, counter)}
                <span className="sr-only"> (opens a new tab)</span>
              </a>
            );
          case "internal":
            return (
              <Link key={i} to={n.to} className="text-[var(--chat-link)] underline underline-offset-2 hover:text-white">
                {renderText(n.text, live, counter)}
              </Link>
            );
        }
      })}
    </>
  );
}

function BlockView({ block, live, tasksBefore, ticks, onTick }: { block: Block; live: boolean; tasksBefore: number; ticks: number[]; onTick: (n: number) => void }) {
  const counter = { n: 0 };
  if (block.type === "p") {
    return (
      <p className="leading-relaxed">
        <Inlines inlines={block.inlines} live={live} counter={counter} />
      </p>
    );
  }
  if (block.type === "h") {
    return (
      <h2 className="font-display text-lg leading-snug pt-1">
        <Inlines inlines={block.inlines} live={live} counter={counter} />
      </h2>
    );
  }
  const taskItems = block.items.filter((i) => i.task);
  if (taskItems.length === 0) {
    return (
      <ul className="list-disc pl-5 space-y-1.5 marker:text-[var(--chat-lavender)]">
        {block.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            <Inlines inlines={item.inlines} live={live} counter={counter} />
          </li>
        ))}
      </ul>
    );
  }
  // A plan: tasks she can tick off, with a count that rolls as she does.
  const done = taskItems.filter((_, i) => ticks.includes(tasksBefore + i)).length;
  let n = tasksBefore;
  return (
    <section aria-label="Your plan" className="rounded-xl border border-[var(--chat-line)] bg-[var(--chat-surface)] p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="font-display text-base">Your plan</h2>
        <p className="text-sm text-[var(--chat-muted)]" aria-live="polite">
          <RollingNumber value={done} /> of {taskItems.length} done
        </p>
      </div>
      <ul className="space-y-1">
        {block.items.map((item, i) => {
          if (!item.task) {
            return (
              <li key={i} className="leading-relaxed pl-1 py-1">
                <Inlines inlines={item.inlines} live={live} counter={counter} />
              </li>
            );
          }
          const index = n++;
          const checked = ticks.includes(index);
          return (
            <li key={i} className="flex items-start gap-3 py-1">
              <button type="button" role="checkbox" aria-checked={checked} aria-label={`Done: ${plain(item.inlines)}`} onClick={() => onTick(index)} className="w360-chat-tick mt-0.5">
                <Check size={14} strokeWidth={3} aria-hidden />
              </button>
              <span className={`leading-relaxed transition-opacity duration-hover ${checked ? "opacity-70" : ""}`}>
                <Inlines inlines={item.inlines} live={live} counter={counter} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const plain = (inlines: Inline[]): string => inlines.map((i) => (i.t === "bold" ? plain(i.children) : i.text)).join("");

function Steps({ steps, done }: { steps: ChatStep[]; done: boolean }) {
  if (steps.length === 0) return null;
  const list = (
    <ol className="space-y-1.5">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5 text-sm text-[var(--chat-muted)]">
          {s.state === "running" && !done ? <span className="w360-chat-dot" aria-hidden /> : <Check size={14} className="text-[var(--chat-link)]" aria-hidden />}
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
  // While it works the steps are in plain sight; afterwards they tuck away, one tap to check how it got there.
  if (!done) return <div className="mb-3">{list}</div>;
  return (
    <details className="mb-3 text-sm text-[var(--chat-muted)]">
      <summary className="cursor-pointer select-none w-fit hover:text-white">How I got this ({steps.length} {steps.length === 1 ? "step" : "steps"})</summary>
      <div className="mt-2">{list}</div>
    </details>
  );
}

/** One answer from the chat: what it did, the answer itself (paragraph by paragraph, plan with tick boxes), what it read, and what she might ask next. */
export function ChatAnswer({ msg, onTick, onAsk, onRetry, canRetry, latest }: { msg: ChatMsg; onTick: (n: number) => void; onAsk: (q: string) => void; onRetry: () => void; canRetry: boolean; latest: boolean }) {
  const sourceSet = useMemo(() => new Set(msg.sources.map((s) => normalizeUrl(s.url))), [msg.sources]);
  const parsed = useMemo(() => parseChat(msg.text, { done: msg.done, sources: sourceSet }), [msg.text, msg.done, sourceSet]);
  const waiting = !msg.done && !msg.error && (parsed.blocks.length === 0 || parsed.pending);

  let tasks = 0;
  return (
    <div className={msg.live ? "w360-chat-live" : undefined} aria-busy={!msg.done}>
      <Steps steps={msg.steps} done={msg.done} />
      <div className="space-y-3.5">
        {parsed.blocks.map((b, i) => {
          const before = tasks;
          tasks += b.type === "list" ? countTasks([b]) : 0;
          return <BlockView key={i} block={b} live={msg.live} tasksBefore={before} ticks={msg.ticks} onTick={onTick} />;
        })}
        {waiting && (
          <div className="w360-chat-pending" aria-hidden>
            <span />
            <span />
          </div>
        )}
      </div>
      {!msg.done && !msg.error && <p className="sr-only" role="status">Writing an answer</p>}
      {msg.error && (
        <div role="alert" className="mt-3 rounded-xl border border-[var(--chat-line)] bg-[var(--chat-surface)] p-3 text-sm">
          <p>{msg.error}</p>
          {canRetry && (
            <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--chat-on-light)] transition-transform duration-press active:scale-[0.97]">
              Try again
            </button>
          )}
        </div>
      )}
      {msg.done && msg.sources.length > 0 && !msg.error && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-[var(--chat-muted)] mb-1.5">Pages I read</p>
          <ul className="flex flex-wrap gap-2">
            {msg.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--chat-line)] px-3 py-1 text-xs hover:bg-[var(--chat-surface-hover)] transition-colors duration-hover">
                  <span className="truncate max-w-[16rem]">{s.title || hostOf(s.url)}</span>
                  <span className="text-[var(--chat-muted)] shrink-0">{hostOf(s.url)}</span>
                  <span className="sr-only">(opens a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {latest && msg.done && !msg.error && parsed.followUps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-[var(--chat-muted)] mb-1.5">Ask next</p>
          <ul className="flex flex-wrap gap-2">
            {parsed.followUps.map((q) => (
              <li key={q}>
                <button type="button" onClick={() => onAsk(q)} className="rounded-full bg-[var(--chat-surface)] border border-[var(--chat-line)] px-3.5 py-1.5 text-sm text-left hover:bg-[var(--chat-surface-hover)] transition-[background-color,transform] duration-hover active:scale-[0.97]">
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
