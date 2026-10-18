import { useEffect, useState, type FormEvent } from "react";
import { messageService } from "@/services/messageService";
import type { Message } from "@/types";
import { ItemList } from "@/components/ui/ItemList";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MessageCircle, Send } from "lucide-react";

interface ThreadReply { from: "me" | "them"; text: string; time: string }

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [openThread, setOpenThread] = useState<Message | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const toast = useToast();

  useEffect(() => {
    messageService.list().then(setMessages);
  }, []);

  if (!messages) return <LoadingState label="Loading messages" />;

  function openMessage(m: Message) {
    setOpenThread(m);
    setReplies([{ from: "them", text: m.preview, time: m.time }]);
    setMessages((list) => (list ? list.map((x) => (x.id === m.id ? { ...x, unread: false } : x)) : list));
  }

  function handleReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("reply") ?? "").trim();
    if (!text) return;
    setReplies((r) => [...r, { from: "me", text, time: "Just now" }]);
    (e.currentTarget as HTMLFormElement).reset();
    toast.show("Message sent");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Messages</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Your conversations with your wellness coach and care team.</p>
      </div>

      {messages.length === 0 ? (
        <EmptyState icon={<MessageCircle size={30} />} title="No messages yet" description="When your coach reaches out, you'll see it here." />
      ) : (
        <ItemList
          maxHeight={520}
          items={messages.map((m) => ({
            id: m.id,
            message: m,
            icon: <span className="text-sm font-medium">{m.from.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>,
            title: m.unread ? `${m.from} · unread` : m.from,
            description: m.preview,
            meta: m.time,
          }))}
          onItemSelect={(row) => openMessage(row.message)}
        />
      )}

      <Modal open={!!openThread} onClose={() => setOpenThread(null)} title={openThread?.from ?? ""} size="md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto w360-scrollbar pr-1">
            {replies.map((r, i) => (
              <div key={i} className={`flex ${r.from === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                    r.from === "me"
                      ? "bg-maroon-700 text-white"
                      : "bg-[var(--w360-bg-warm)] text-[var(--w360-text)]"
                  }`}
                >
                  <p>{r.text}</p>
                  <p className={`text-[10px] mt-1 ${r.from === "me" ? "text-white/70" : "text-[var(--w360-text-muted)]"}`}>{r.time}</p>
                </div>
              </div>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={handleReply}>
            <input
              name="reply"
              placeholder="Write a reply…"
              className="flex-1 px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm"
            />
            <Button type="submit" size="sm"><Send size={15} /></Button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
