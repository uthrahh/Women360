import { useEffect, useState } from "react";
import type { DayState, ProgrammeTask } from "@/types/programme";
import { CATEGORY_LABEL } from "@/types/programme";
import { programmeService } from "@/services/programmeService";
import { HabitTick } from "@/components/ui/HabitTick";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { NumberField } from "@/components/ui/NumberField";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";

type LogType = "DONE" | "SKIPPED" | "NEED_HELP" | "UNDONE";
const amount = (v: number | null, unit: string | null) => `${v ?? 0}${unit ? " " + unit : ""}`;

/**
 * One task on one of her days. Ticking is one tap and optimistic (the screen changes first, with Undo); an amount task with a
 * target is one tap for exactly the target. Skipping or asking for help opens a short note. Her coach's replies sit under it.
 */
export function TaskRow({ task, date, isToday, onUpdated }: { task: ProgrammeTask & { state: DayState }; date: string; isToday: boolean; onUpdated: () => void }) {
  const [state, setState] = useState<DayState>(task.state);
  useEffect(() => setState(task.state), [task.state]);
  const [typing, setTyping] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState<"SKIPPED" | "NEED_HELP" | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function send(type: LogType, extra: { value?: number | null; note?: string | null } = {}, optimistic?: Partial<DayState>) {
    const before = state;
    if (optimistic) setState({ ...state, ...optimistic });
    setBusy(true);
    try {
      const next = await programmeService.logTask(task.id, { date, type, ...extra });
      setState(next);
      if (type === "DONE") toast.show(`Done: ${task.title}`, { action: { label: "Undo", onClick: () => void send("UNDONE", {}, { status: "open", value: null, note: null }) } });
      onUpdated();
      return true;
    } catch (err) {
      setState(before);
      toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const done = state.status === "done";
  const open = state.status === "open";

  return (
    <li className="py-4 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {task.kind === "CHECK" && (
          <HabitTick
            done={done}
            label={task.title}
            onChange={(next) => void send(next ? "DONE" : "UNDONE", {}, { status: next ? "done" : "open" })}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{task.title}</h3>
          <p className="text-xs text-[var(--w360-text-muted)] flex flex-wrap items-center gap-2 mt-0.5">
            <Badge>{CATEGORY_LABEL[task.category]}</Badge>
            {task.kind === "AMOUNT" && task.target !== null && <span className="tabular-nums">Aim: {amount(task.target, task.unit)}</span>}
          </p>
        </div>
      </div>

      {task.safetyNotes && <p className="text-xs text-amber-800 dark:text-amber-300">{task.safetyNotes}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--w360-text-muted)]">How to do it</summary>
        <p className="mt-1 whitespace-pre-line measure">{task.instructions}</p>
      </details>

      {/* What she has reported, and how to change it. */}
      {done && task.kind !== "CHECK" && (
        <p className="text-sm">
          <span className="font-medium">Done</span>
          {task.kind === "AMOUNT" && <span className="tabular-nums">: {amount(state.value, task.unit)}</span>}
          {task.kind === "REFLECTION" && state.note && <span className="block text-[var(--w360-text-muted)] whitespace-pre-line">“{state.note}”</span>}{" "}
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send("UNDONE", {}, { status: "open" })}>Undo</Button>
        </p>
      )}
      {state.status === "skipped" && (
        <p className="text-sm">
          <span className="font-medium">Skipped</span>
          {state.note && <span className="text-[var(--w360-text-muted)]">: {state.note}</span>}{" "}
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send("UNDONE", {}, { status: "open" })}>Undo</Button>
        </p>
      )}
      {state.status === "help" && (
        <p className="text-sm">
          <span className="font-medium">You asked your coach for help</span>
          {state.note && <span className="text-[var(--w360-text-muted)]">: {state.note}</span>}
        </p>
      )}

      {(open || state.status === "help") && (
        <div className="flex flex-wrap items-center gap-2">
          {task.kind === "AMOUNT" && !typing && task.target !== null && (
            <Button size="sm" disabled={busy} onClick={() => void send("DONE", { value: task.target }, { status: "done", value: task.target })}>
              Done: {amount(task.target, task.unit)}
            </Button>
          )}
          {task.kind === "AMOUNT" && !typing && (
            <Button size="sm" variant={task.target === null ? "primary" : "secondary"} onClick={() => setTyping(true)}>
              {task.target === null ? "Enter how much" : "A different amount"}
            </Button>
          )}
          {task.kind === "REFLECTION" && !typing && (
            <Button size="sm" onClick={() => setTyping(true)}>Write it</Button>
          )}
          {!typing && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setNote(""); setAsk("SKIPPED"); }}>{isToday ? "Skip today" : "Skip"}</Button>
              {state.status !== "help" && <Button size="sm" variant="ghost" onClick={() => { setNote(""); setAsk("NEED_HELP"); }}>Ask for help</Button>}
            </>
          )}
        </div>
      )}

      {typing && (
        <form
          className="flex flex-col gap-2 max-w-md"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok =
              task.kind === "AMOUNT"
                ? value !== "" && (await send("DONE", { value: Number(value) }, { status: "done", value: Number(value) }))
                : await send("DONE", { note: note.trim() || null }, { status: "done", note: note.trim() || null });
            if (ok) setTyping(false);
          }}
        >
          {task.kind === "AMOUNT" ? (
            <NumberField label="How much" suffix={task.unit ?? undefined} max={100000} startAt={task.target ?? 1} value={value} onChange={setValue} />
          ) : (
            <TextArea label="Your reflection" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || (task.kind === "AMOUNT" && value === "")}>Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTyping(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {state.replies.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {state.replies.map((r) => (
            <li key={r.at} className="border-l-2 border-maroon-600 dark:border-maroon-300 pl-3 text-sm">
              <span className="text-xs text-[var(--w360-text-muted)] block">Your coach replied</span>
              <span className="whitespace-pre-line">{r.note}</span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={ask !== null} onClose={() => setAsk(null)} title={ask === "NEED_HELP" ? "Ask your coach for help" : isToday ? "Skip today" : "Skip this one"} size="sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ask) return;
            const ok = await send(ask, { note: note.trim() || null }, { status: ask === "NEED_HELP" ? "help" : "skipped", note: note.trim() || null });
            if (ok) {
              setAsk(null);
              if (ask === "NEED_HELP") toast.show("Sent to your coach");
            }
          }}
        >
          <TextArea
            label={ask === "NEED_HELP" ? "What's getting in the way?" : "Why not?"}
            optional
            note={ask === "NEED_HELP" ? "Your coach reads this and replies here." : undefined}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <Button type="submit" disabled={busy}>{ask === "NEED_HELP" ? "Send to my coach" : "Skip"}</Button>
        </form>
      </Modal>
    </li>
  );
}
