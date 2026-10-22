import { useEffect, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { coachService } from "@/services/coachService";
import { day } from "@/features/admin/format";
import type { NoteFromCoach, SharedCoach } from "@/types";

/**
 * Who can see her information. She adds a wellness coach by email and can take
 * the access back at any time; a coach never sees her health profile or medicines.
 */
export function CoachAccessTab() {
  const toast = useToast();
  const [coaches, setCoaches] = useState<SharedCoach[] | null>(null);
  const [notes, setNotes] = useState<NoteFromCoach[]>([]);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<SharedCoach | null>(null);

  const load = () => {
    setFailed(false);
    Promise.all([coachService.listSharing(), coachService.notesForMe()])
      .then(([c, n]) => {
        setCoaches(c);
        setNotes(n);
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  async function share(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your coach's email.");
      return;
    }
    setBusy(true);
    try {
      await coachService.grant(email.trim());
      setEmail("");
      toast.show("Shared. Your coach can now see the summary described above.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't share with that coach.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!removing) return;
    try {
      await coachService.revoke(removing.coach.id);
      toast.show(`${removing.coach.name} can no longer see your information.`);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't remove that access.", { tone: "error" });
    } finally {
      setRemoving(null);
    }
  }

  if (failed) return <ErrorState title="Couldn't load your sharing settings" onRetry={load} />;
  if (!coaches) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody className="pt-5 flex flex-col gap-4">
          <div>
            <h3 className="font-medium">Share with a wellness coach</h3>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1 max-w-xl">
              A coach you add sees a summary of your goals, mood, sleep, activity and coaching appointments. They never see your health profile or medicines, and you can take access back at any time.
            </p>
          </div>
          <form onSubmit={share} className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-80">
              <Input label="Coach's email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error || undefined} placeholder="coach@example.com" />
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Sharing..." : "Share"}</Button>
          </form>
        </CardBody>
      </Card>

      <section aria-label="Coaches with access">
        <h3 className="font-medium mb-3">Who can see your information</h3>
        {coaches.length === 0 ? (
          <EmptyState title="No one yet" description="Only you can see your information right now." />
        ) : (
          <ul className="flex flex-col gap-3">
            {coaches.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardBody className="pt-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.coach.name}</p>
                      <p className="text-sm text-[var(--w360-text-muted)] break-all">{c.coach.email}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setRemoving(c)}>Stop sharing</Button>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Notes from your coach">
        <h3 className="font-medium mb-3">Notes from your coach</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-[var(--w360-text-muted)]">Notes your coach chooses to share with you appear here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-[var(--w360-border)] p-3 text-sm">
                <p>{n.note}</p>
                <p className="mt-2 text-xs text-[var(--w360-text-muted)]">{n.coach.name} · {day(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={removing !== null}
        title="Stop sharing?"
        description={removing ? `${removing.coach.name} will no longer be able to see your summary. You can share again later.` : undefined}
        confirmLabel="Stop sharing"
        onConfirm={revoke}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
