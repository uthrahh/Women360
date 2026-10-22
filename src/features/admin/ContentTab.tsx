import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { adminService } from "@/services/adminService";
import type { AdminArticle } from "@/types";

interface Draft {
  title: string;
  category: string;
  readMins: string;
  dek: string;
  body: string;
  publish: boolean;
}
const blank = (): Draft => ({ title: "", category: "", readMins: "3", dek: "", body: "", publish: false });
const draftOf = (a: AdminArticle): Draft => ({
  title: a.title,
  category: a.category,
  readMins: String(a.readMins),
  dek: a.dek,
  body: a.body ?? "",
  publish: a.publishedAt !== null,
});

/** The educational content in the Learn library: write, publish, unpublish and remove. */
export function ContentTab({ readOnly }: { readOnly: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<AdminArticle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<AdminArticle | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AdminArticle | null>(null);

  const load = () => {
    setFailed(false);
    adminService.articles().then(setItems).catch(() => setFailed(true));
  };
  useEffect(load, []);

  const open = (a: AdminArticle | "new") => {
    setDraft(a === "new" ? blank() : draftOf(a));
    setEditing(a);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const minutes = Number(draft.readMins);
    if (!draft.title.trim() || !draft.category.trim() || !draft.dek.trim() || !(minutes >= 1)) {
      toast.show("Fill in the title, category, summary and reading time.", { tone: "error" });
      return;
    }
    const input = { title: draft.title.trim(), category: draft.category.trim(), readMins: minutes, dek: draft.dek.trim(), body: draft.body.trim() || undefined, publish: draft.publish };
    setSaving(true);
    try {
      if (editing === "new") await adminService.createArticle(input);
      else if (editing) await adminService.updateArticle(editing.id, input);
      toast.show("Article saved");
      setEditing(null);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that article.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await adminService.deleteArticle(removing.id);
      toast.show("Article deleted");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that article.", { tone: "error" });
    } finally {
      setRemoving(null);
    }
  }

  if (failed) return <ErrorState title="Couldn't load the articles" onRetry={load} />;
  if (!items) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--w360-text-muted)] max-w-xl">
          The Learn library. Health content should be reviewed by a qualified person before it is published.
        </p>
        <Button size="sm" disabled={readOnly} onClick={() => open("new")}><Plus size={15} /> New article</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No articles yet" description="Write the first one." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <Card>
                <CardBody className="pt-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-[var(--w360-text-muted)] mt-0.5">{a.dek}</p>
                    <p className="text-xs text-[var(--w360-text-muted)] mt-1">{a.category} · {a.readMins} min</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={a.publishedAt ? "success" : "neutral"}>{a.publishedAt ? "Published" : "Draft"}</Badge>
                    <Button size="sm" variant="ghost" disabled={readOnly} aria-label={`Edit ${a.title}`} onClick={() => open(a)}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" disabled={readOnly} aria-label={`Delete ${a.title}`} onClick={() => setRemoving(a)}><Trash2 size={15} /></Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {readOnly && <p className="text-xs text-[var(--w360-text-muted)]">This account is read-only, so articles cannot be changed.</p>}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New article" : "Edit article"} size="md">
        <form className="flex flex-col gap-4" onSubmit={save}>
          <Input label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={80} required />
            <Input label="Minutes to read" type="number" min={1} max={120} value={draft.readMins} onChange={(e) => setDraft({ ...draft, readMins: e.target.value })} required />
          </div>
          <Input label="One-line summary" value={draft.dek} onChange={(e) => setDraft({ ...draft, dek: e.target.value })} maxLength={280} required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="article-body" className="text-sm font-medium">Text</label>
            <textarea
              id="article-body"
              rows={6}
              maxLength={20000}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="px-4 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.publish} onChange={(e) => setDraft({ ...draft, publish: e.target.checked })} className="w-4 h-4 accent-[var(--w360-accent)]" />
            Publish so everyone can read it
          </label>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save article"}</Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title="Delete this article?"
        description={removing ? `"${removing.title}" will be removed from the Learn library.` : undefined}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
