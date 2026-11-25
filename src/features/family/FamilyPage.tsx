import { useCallback, useEffect, useState } from "react";
import { familyService } from "@/services/familyService";
import type { FamilyLevel, FamilyOverview } from "@/types/family";
import { LEVEL_LABEL } from "@/types/family";
import { useFamily } from "@/context/FamilyContext";
import { useApp } from "@/context/AppContext";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { DateWheel } from "@/components/ui/DateWheel";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Hint } from "@/components/ui/Hint";
import { useToast } from "@/components/ui/Toast";
import { saveFile } from "@/lib/saveFile";
import { localDateISO } from "@/services/mappers";

const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const ageOf = (dob: string) => {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = localDateISO().split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/** What family access covers and what it never does. Plain text, always shown where access is given. */
const COVERS =
  "Access covers tracking: cycle, food and water, activity and steps, sleep, mood, habits, goals, medicines, appointments and measurements. Never the account, password, data download, contraception or pregnancy record, messages, programme or AI chat.";

/**
 * Family: profiles she keeps for people who don't use the app themselves (a teenager from 13, or a parent), and access between
 * two accounts, where the owner of the records decides whether the other person can view them or view and update them.
 */
export default function FamilyPage() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<"profile" | "share" | "ask" | null>(null);
  const [editing, setEditing] = useState<FamilyOverview["managed"][number] | null>(null);
  const [deleting, setDeleting] = useState<FamilyOverview["managed"][number] | null>(null);
  const { open } = useFamily();
  const { auth } = useApp();
  const nav = useTransitionNavigate();
  const toast = useToast();
  const demo = !!auth.user?.isDemo;

  const load = useCallback(() => {
    setFailed(false);
    familyService.overview().then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load your family" onRetry={load} />;
  if (!data) return <LoadingState />;

  const act = async (fn: () => Promise<unknown>, done: string, fallback: string) => {
    try {
      await fn();
      toast.show(done);
      load();
      return true;
    } catch (err) {
      toast.show(errText(err, fallback), { tone: "error" });
      return false;
    }
  };
  const openRecords = async (id: string) => {
    try {
      await open(id);
      nav("/app/dashboard");
    } catch (err) {
      toast.show(errText(err, "Couldn't open those records."), { tone: "error" });
    }
  };

  const people = [
    ...data.managed.map((m) => ({ key: m.id, id: m.id, name: m.name, detail: [m.relation, m.dateOfBirth ? `${ageOf(m.dateOfBirth)} years` : null, "Profile you keep"].filter(Boolean).join(" · "), managed: m })),
    ...data.sharedWithMe.map((s) => ({ key: s.accessId, id: s.person.id, name: s.person.name, detail: `Shares with you · ${LEVEL_LABEL[s.level]}`, accessId: s.accessId })),
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Family</h1>
          <Hint id="family-intro" className="text-[var(--w360-text-muted)] mt-1 measure">
            Keep records for someone who doesn't use the app, or link with a family member's own account. Open someone's records to see their
            days, and come back to yours from the bar at the top.
          </Hint>
        </div>
        {!demo && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDialog("profile")}>Add a family profile</Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("share")}>Share my records</Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("ask")}>Ask to see someone's</Button>
          </div>
        )}
      </header>
      {demo && <p className="text-sm text-[var(--w360-text-muted)]">Family links and profiles aren't available on the shared demonstration account.</p>}

      <section aria-labelledby="fam-people" className="flex flex-col gap-3">
        <h2 id="fam-people" className="font-display text-xl font-semibold">People you look after</h2>
        {people.length === 0 ? (
          <p className="text-sm text-[var(--w360-text-muted)] measure">No one yet. Add a profile for a family member, or ask someone to share their records with you.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
            {people.map((p) => (
              <li key={p.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--w360-text-muted)]">{p.detail}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => openRecords(p.id)}>Open records<span className="sr-only">: {p.name}</span></Button>
                  {"managed" in p && p.managed && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p.managed!)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const json = await familyService.exportProfile(p.id);
                            await saveFile(`women360-${p.name.toLowerCase().replace(/\s+/g, "-")}-${localDateISO()}.json`, JSON.stringify(json, null, 2), "application/json", `${p.name}'s Women360 records`);
                          } catch (err) {
                            toast.show(errText(err, "Couldn't download it."), { tone: "error" });
                          }
                        }}
                      >
                        Download
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(p.managed!)}>Delete</Button>
                    </>
                  )}
                  {"accessId" in p && p.accessId && (
                    <Button size="sm" variant="ghost" onClick={() => act(() => familyService.end(p.accessId!), `You no longer see ${p.name}'s records`, "Couldn't stop it.")}>
                      Stop viewing
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.myRequests.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.myRequests.map((r) => (
              <li key={r.accessId} className="flex flex-wrap items-center gap-2">
                <span>Waiting for {r.person.name} to answer your request.</span>
                <Button size="sm" variant="ghost" onClick={() => act(() => familyService.end(r.accessId), "Request withdrawn", "Couldn't withdraw it.")}>Withdraw</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fam-mine" className="flex flex-col gap-3">
        <h2 id="fam-mine" className="font-display text-xl font-semibold">Who can see your records</h2>
        <p className="text-sm text-[var(--w360-text-muted)] measure">{COVERS} You decide the access and can change it or stop it at any time.</p>
        {data.requestsToMe.map((r) => (
          <div key={r.accessId} className="rounded-xl border border-maroon-600 dark:border-maroon-300 p-4 flex flex-col gap-3">
            <p className="text-sm"><span className="font-medium">{r.person.name}</span> ({r.person.email}) asked to see your records.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => act(() => familyService.setLevel(r.accessId, "MONITOR"), `${r.person.name} can view your records`, "Couldn't save.")}>Let them view</Button>
              <Button size="sm" variant="secondary" onClick={() => act(() => familyService.setLevel(r.accessId, "MODIFY"), `${r.person.name} can view and update your records`, "Couldn't save.")}>View and update</Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => familyService.end(r.accessId), "Declined", "Couldn't decline.")}>Decline</Button>
            </div>
          </div>
        ))}
        {data.sharingWith.length === 0 ? (
          <p className="text-sm">No one.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
            {data.sharingWith.map((s) => (
              <li key={s.accessId} className="py-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{s.person.name}</p>
                  <p className="text-xs text-[var(--w360-text-muted)]">{s.person.email}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <SegmentedChoice<FamilyLevel>
                    label={`What ${s.person.name} can do`}
                    options={[{ value: "MONITOR", label: "View" }, { value: "MODIFY", label: "View and update" }]}
                    value={s.level}
                    onChange={(level) => act(() => familyService.setLevel(s.accessId, level), "Access changed", "Couldn't change it.")}
                  />
                  <Button size="sm" variant="ghost" onClick={() => act(() => familyService.end(s.accessId), `${s.person.name} can no longer see your records`, "Couldn't stop sharing.")}>
                    Stop sharing
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileDialog open={dialog === "profile"} onClose={() => setDialog(null)} onSaved={load} />
      {editing && <ProfileDialog open existing={editing} onClose={() => setEditing(null)} onSaved={load} />}
      <EmailDialog kind="share" open={dialog === "share"} onClose={() => setDialog(null)} onSaved={load} />
      <EmailDialog kind="ask" open={dialog === "ask"} onClose={() => setDialog(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ""}'s profile?`}
        description="Every record kept in this profile is deleted for good. Download it first if you want a copy."
        confirmLabel="Delete profile"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting;
          setDeleting(null);
          if (d) await act(() => familyService.deleteProfile(d.id), `${d.name}'s profile was deleted`, "Couldn't delete it.");
        }}
      />
    </div>
  );
}

function ProfileDialog({ open, existing, onClose, onSaved }: { open: boolean; existing?: FamilyOverview["managed"][number]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [relation, setRelation] = useState(existing?.relation ?? "");
  const [dob, setDob] = useState(existing?.dateOfBirth ?? "");
  const [cycle, setCycle] = useState<"yes" | "no">(existing ? (existing.cycleTracking ? "yes" : "no") : "no");
  const [guardian, setGuardian] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const minor = dob !== "" && ageOf(dob) < 18;

  async function save() {
    setError("");
    if (!name.trim()) return setError("Enter their name.");
    if (!dob) return setError("Choose their date of birth.");
    if (ageOf(dob) < 13) return setError("Family profiles are for people aged 13 and over.");
    if (minor && !guardian && !existing) return setError("Confirm that you are their parent or legal guardian.");
    setBusy(true);
    try {
      const body = { name: name.trim(), relation: relation.trim() || null, dateOfBirth: dob, cycleTracking: cycle === "yes", guardianConfirmed: guardian || undefined };
      if (existing) await familyService.updateProfile(existing.id, body);
      else await familyService.createProfile(body);
      toast.show(existing ? "Saved" : `${name.trim()}'s profile is ready. Open their records to start logging.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errText(err, "Couldn't save the profile."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? `Edit ${existing.name}` : "Add a family profile"} size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!existing && <p className="text-sm text-[var(--w360-text-muted)]">For someone who won't sign in themselves. You keep their records, and only you can see them.</p>}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
        <Input label="Who they are to you (optional)" placeholder="Daughter, Mother…" value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={40} />
        <DateWheel label="Date of birth" value={dob} onChange={setDob} yearsBack={110} />
        <SegmentedChoice<"yes" | "no"> label="Track periods" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value={cycle} onChange={setCycle} />
        {minor && !existing && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="mt-1" />
            <span>I am their parent or legal guardian, and I agree to keep their health records here for them.</span>
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save" : "Add profile"}</Button>
      </form>
    </Modal>
  );
}

function EmailDialog({ kind, open, onClose, onSaved }: { kind: "share" | "ask"; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<FamilyLevel>("MONITOR");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (open) {
      setEmail("");
      setError("");
      setLevel("MONITOR");
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={kind === "share" ? "Share my records" : "Ask to see someone's records"} size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (!email.trim()) return setError("Enter the address they sign in with.");
          setBusy(true);
          try {
            if (kind === "share") await familyService.share(email.trim(), level);
            else await familyService.ask(email.trim());
            toast.show(kind === "share" ? "Shared. They've been told." : "Asked. They choose what to share.");
            onSaved();
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't send it."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input label="Their Women360 address" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        {kind === "share" ? (
          <>
            <SegmentedChoice<FamilyLevel> label="They can" options={[{ value: "MONITOR", label: "View" }, { value: "MODIFY", label: "View and update" }]} value={level} onChange={setLevel} />
            <p className="text-xs text-[var(--w360-text-muted)]">{COVERS}</p>
          </>
        ) : (
          <p className="text-xs text-[var(--w360-text-muted)]">They decide whether you can view, or view and update, their records, and can stop it at any time.</p>
        )}
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : kind === "share" ? "Share" : "Ask"}</Button>
      </form>
    </Modal>
  );
}
