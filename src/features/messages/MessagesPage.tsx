import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { messageService } from "@/services/messageService";
import { coachService } from "@/services/coachService";
import { toRelativeDay } from "@/services/mappers";
import { ItemList } from "@/components/ui/ItemList";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Modal } from "@/components/ui/Modal";

interface Entry {
  id: string;
  from: string;
  text: string;
  time: string;
  unread: boolean;
  /** A coach note has no read state on the server; a message does. */
  isMessage: boolean;
}

/**
 * What her wellness coach and the care team have sent her: messages, and the
 * notes a coach chose to share. This is read-only: there is no way to reply in
 * the app, and the page says so rather than offering a box that goes nowhere.
 */
export default function MessagesPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Entry | null>(null);

  const load = () => {
    setFailed(false);
    Promise.all([messageService.list(), coachService.notesForMe()])
      .then(([messages, notes]) => {
        const fromMessages: Entry[] = messages.map((m) => ({ id: `m-${m.id}`, from: m.from, text: m.preview, time: m.time, unread: m.unread, isMessage: true }));
        const fromNotes: Entry[] = notes.map((n) => ({ id: `n-${n.id}`, from: n.coach.name, text: n.note, time: toRelativeDay(n.createdAt), unread: false, isMessage: false }));
        setEntries([...fromNotes, ...fromMessages]);
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  function show(e: Entry) {
    setOpen(e);
    if (!e.unread || !e.isMessage) return;
    setEntries((list) => (list ? list.map((x) => (x.id === e.id ? { ...x, unread: false } : x)) : list));
    messageService.markRead(e.id.slice(2)).catch(() => undefined);
  }

  if (failed) return <ErrorState title="Couldn't load your messages" onRetry={load} />;
  if (!entries) return <LoadingState label="Loading messages" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Messages</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Messages and notes from your wellness coach and care team.</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={30} />}
          title="Nothing here yet"
          description="When a coach you have shared with leaves you a note, it appears here. You can share under Settings, Privacy & sharing."
        />
      ) : (
        <ItemList
          ariaLabel="Messages and notes"
          maxHeight={520}
          items={entries.map((m) => ({
            id: m.id,
            entry: m,
            icon: <span className="text-sm font-medium">{m.from.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>,
            title: m.unread ? `${m.from} · unread` : m.from,
            description: m.text,
            meta: m.time,
          }))}
          onItemSelect={(row) => show(row.entry)}
        />
      )}
      <p className="text-xs text-[var(--w360-text-muted)]">
        You can't reply inside Women360 yet. To respond, contact your coach directly.
      </p>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.from ?? ""} size="md">
        {open && (
          <div className="flex flex-col gap-3">
            <p className="text-sm whitespace-pre-wrap">{open.text}</p>
            <p className="text-xs text-[var(--w360-text-muted)]">{open.time}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
