import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { localDateISO } from "@/services/mappers";
import { saveFile } from "@/lib/saveFile";
import { isNativeApp } from "@/lib/platform";

export function YourDataTab() {
  const { auth } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cyclePassword, setCyclePassword] = useState("");
  const [cycleError, setCycleError] = useState("");
  const [cycleDeleting, setCycleDeleting] = useState(false);

  // The phone's device-only account has a password nobody knows or types, so
  // it can't be confirmed here — and deleting it would just be re-created at
  // the next launch. Clearing the app's storage in Android settings is the way.
  const deviceOnly = isNativeApp();

  async function exportData() {
    setExporting(true);
    try {
      const data = await userService.exportData();
      const result = await saveFile(
        `women360-data-${localDateISO()}.json`,
        JSON.stringify(data, null, 2),
        "application/json",
        "My Women360 data"
      );
      if (result === "downloaded") toast.show("Download started");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.show(err instanceof Error ? err.message : "Couldn't export your data. Please try again.", { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  function closeConfirm() {
    if (deleting) return;
    setConfirmOpen(false);
    setPassword("");
    setTyped("");
    setError("");
  }

  function closeCycle() {
    if (cycleDeleting) return;
    setCycleOpen(false);
    setCyclePassword("");
    setCycleError("");
  }

  async function onDeleteCycle(e: FormEvent) {
    e.preventDefault();
    setCycleError("");
    setCycleDeleting(true);
    try {
      const { deletedDays } = await authService.deleteCycleHistory(cyclePassword);
      setCycleDeleting(false);
      setCycleOpen(false);
      setCyclePassword("");
      toast.show(`Cycle history deleted (${deletedDays} ${deletedDays === 1 ? "day" : "days"}).`);
    } catch (err) {
      setCycleError(err instanceof Error ? err.message : "Couldn't delete your cycle history. Please try again.");
      setCycleDeleting(false);
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setDeleting(true);
    try {
      await authService.deleteAccount(password);
      auth.logout();
      toast.show("Your account and data have been deleted.");
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody className="pt-5 flex flex-col gap-3">
          <div>
            <p className="font-medium">Download your data</p>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1 max-w-lg">
              A complete copy of what Women360 holds about you — your profile, cycle, nutrition, caffeine, alcohol and
              digestion, activity, sleep, wellbeing, goals, medicines, appointments and messages — as a JSON file. It never includes your password
              or sign-in codes.
            </p>
          </div>
          <Button size="sm" variant="secondary" className="w-fit" onClick={exportData} disabled={exporting}>
            <Download size={15} /> {exporting ? "Preparing…" : "Download my data"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5 flex flex-col gap-3">
          <div>
            <p className="font-medium">Delete your cycle and reproductive history</p>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1 max-w-lg">
              Permanently erases every period and cycle day you logged (with their symptoms and details), your cycle
              settings, your contraception and pregnancy record and the conditions you told Women360 about. Your account
              and everything else stay. This can&apos;t be undone.
            </p>
          </div>
          {deviceOnly || auth.user?.isDemo ? (
            <p className="text-sm text-[var(--w360-text-muted)]">
              {deviceOnly
                ? "This phone uses a device-only account with no password to confirm, so this isn't available here."
                : "Not available on a shared demo account."}
            </p>
          ) : (
            <Button size="sm" variant="danger" className="w-fit" onClick={() => setCycleOpen(true)}>
              Delete my cycle history…
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5 flex flex-col gap-3">
          <div>
            <p className="font-medium">Delete your account</p>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1 max-w-lg">
              Permanently erases your account and everything in it, from every device. This can't be undone, so
              download your data first if you want a copy.
            </p>
          </div>
          {deviceOnly ? (
            <p className="text-sm text-[var(--w360-text-muted)]">
              This phone uses a device-only account with no password to confirm. To remove its data, clear Women360's
              storage in your phone's app settings.
            </p>
          ) : (
            <Button size="sm" variant="danger" className="w-fit" onClick={() => setConfirmOpen(true)}>
              Delete my account…
            </Button>
          )}
        </CardBody>
      </Card>

      <Modal open={cycleOpen} onClose={closeCycle} title="Delete your cycle history?" size="sm">
        <form className="flex flex-col gap-4" onSubmit={onDeleteCycle}>
          <p className="text-sm text-[var(--w360-text-muted)]">
            Your cycle days, cycle settings, reproductive record and declared conditions are erased immediately and
            permanently. Enter your password to confirm.
          </p>
          <PasswordField label="Password" value={cyclePassword} onChange={setCyclePassword} error={cycleError || undefined} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={cycleDeleting || !cyclePassword}>
              {cycleDeleting ? "Deleting…" : "Delete cycle history"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeCycle} disabled={cycleDeleting}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmOpen} onClose={closeConfirm} title="Delete your account?" size="sm">
        <form className="flex flex-col gap-4" onSubmit={onDelete}>
          <p className="text-sm text-[var(--w360-text-muted)]">
            Everything is erased immediately and permanently. Type <span className="font-semibold text-[var(--w360-text)]">DELETE</span> and
            your password to confirm.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type DELETE
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="px-4 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm font-normal"
            />
          </label>
          <PasswordField label="Password" value={password} onChange={setPassword} error={error || undefined} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={deleting || typed !== "DELETE" || !password}>
              {deleting ? "Deleting…" : "Delete everything"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeConfirm} disabled={deleting}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
