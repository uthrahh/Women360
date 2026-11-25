import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { adminCoachService } from "@/services/clientService";
import type { Speciality } from "@/types/clients";
import { SPECIALITY_CODES, SPECIALITY_LABEL } from "@/types/clients";
import { MultiChoiceRow } from "@/components/ui/ChoiceRow";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";

type Coach = Awaited<ReturnType<typeof adminCoachService.list>>[number];
const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const choices = SPECIALITY_CODES.map((c) => ({ value: c, label: SPECIALITY_LABEL[c] }));

/** Coaches and their specialities (which decide the parts of a client's record each sees), and new coach accounts by one-time link. */
export function CoachesTab({ readOnly }: { readOnly: boolean }) {
  const [list, setList] = useState<Coach[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState<{ name: string; link: string } | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setFailed(false);
    adminCoachService.list().then(setList).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load the coaches" onRetry={load} />;
  if (!list) return <LoadingState variant="rows" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--w360-text-muted)] measure">
          A coach sees only the parts of a client's record that match their specialities. General wellness sees every part; a coach with none set
          is treated as general.
        </p>
        {!readOnly && <Button size="sm" onClick={() => setAdding(true)}>Add a coach</Button>}
      </div>
      {link && <LinkBox name={link.name} link={link.link} onDone={() => setLink(null)} />}
      {list.length === 0 ? (
        <p className="text-sm">No coaches yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {list.map((c) => (
            <li key={c.id} className="py-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {c.name} {c.pending && <Badge tone="warning">Hasn't set a password</Badge>}
                </p>
                <p className="text-xs text-[var(--w360-text-muted)] tabular-nums">{c.email} · {c.clients} {c.clients === 1 ? "client" : "clients"}</p>
              </div>
              {readOnly ? (
                <p className="text-sm">{(c.specialities.length ? c.specialities : ["GENERAL" as Speciality]).map((s) => SPECIALITY_LABEL[s]).join(", ")}</p>
              ) : (
                <MultiChoiceRow
                  label={`${c.name}'s specialities`}
                  choices={choices}
                  value={c.specialities}
                  max={5}
                  onChange={async (next) => {
                    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, specialities: next } : x)) ?? null);
                    try {
                      await adminCoachService.setSpecialities(c.id, next);
                    } catch (err) {
                      toast.show(errText(err, "Couldn't save."), { tone: "error" });
                      load();
                    }
                  }}
                />
              )}
              {!readOnly && c.pending && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={async () => {
                    try {
                      setLink({ name: c.name, link: (await adminCoachService.newLink(c.id)).link });
                    } catch (err) {
                      toast.show(errText(err, "Couldn't make a link."), { tone: "error" });
                    }
                  }}
                >
                  New sign-up link
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <NewCoachDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(name, l) => {
          setLink({ name, link: l });
          load();
        }}
      />
    </div>
  );
}

function LinkBox({ name, link, onDone }: { name: string; link: string; onDone: () => void }) {
  const toast = useToast();
  return (
    <div role="status" className="rounded-xl border-2 border-maroon-600 dark:border-maroon-300 p-4 flex flex-col gap-2">
      <p className="text-sm">Send this link to {name}. It works once, for 7 days, and lets them set their password.</p>
      <code className="text-xs break-all rounded border border-[var(--w360-border)] px-2 py-1.5 bg-[var(--w360-bg-raised)]">{link}</code>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.show("Link copied"), () => undefined)}>
          <Copy size={14} aria-hidden /> Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function NewCoachDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string, link: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [specs, setSpecs] = useState<Speciality[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setSpecs([]);
      setError("");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add a coach" size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !email.trim()) return setError("Enter their name and email.");
          try {
            const res = await adminCoachService.create({ name: name.trim(), email: email.trim(), specialities: specs });
            onCreated(name.trim(), res.link);
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't add the coach."));
          }
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="off" />
        <MultiChoiceRow label="Specialities" choices={choices} value={specs} onChange={setSpecs} max={5} />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit">Add and make a sign-up link</Button>
      </form>
    </Modal>
  );
}
