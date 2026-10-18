import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import { authService, type TwoFactorStatus } from "@/services/authService";
import { passwordAcceptable } from "@/lib/passwordPolicy";
import { isNativeApp } from "@/lib/platform";

export function SecurityTab() {
  // The phone app signs in with a throwaway device account whose password
  // nobody knows or types. A password change or a sign-in code would lock the
  // person out of their own data, so these controls belong to real accounts.
  if (isNativeApp()) {
    return (
      <Card>
        <CardBody className="pt-5 flex gap-3">
          <ShieldCheck size={20} className="text-maroon-700 dark:text-maroon-200 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium">This phone uses a device-only account</p>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1">
              It signs in automatically on this device, so there's no password or sign-in code to manage here. Password
              and two-factor options appear once you create a full account.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChangePasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}

function ChangePasswordCard() {
  const { auth } = useApp();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ctx = { email: auth.user?.email, name: auth.user?.name };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!current) return setError("Enter your current password.");
    if (!passwordAcceptable(next, ctx)) return setError("Choose a new password that meets every rule below.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    try {
      auth.refreshUser(await authService.changePassword(current, next));
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.show("Password changed. Other devices have been signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <p className="text-sm text-[var(--w360-text-muted)] mt-1 mb-4">
          Changing it signs you out everywhere else straight away.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" required />
          <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" policyContext={ctx} required />
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={error || undefined} required />
          <div>
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Change password"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

type TwoFactorView =
  | { step: "idle" }
  | { step: "setup"; secret: string; uri: string }
  | { step: "codes"; codes: string[] }
  | { step: "disable" }
  | { step: "regenerate" };

function TwoFactorCard() {
  const { auth } = useApp();
  const toast = useToast();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<TwoFactorView>({ step: "idle" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    authService.getTwoFactorStatus().then((s) => { setStatus(s); setLoadError(false); }).catch(() => setLoadError(true));
  useEffect(() => { void refresh(); }, []);

  const reset = () => { setView({ step: "idle" }); setCode(""); setPassword(""); setError(""); };

  async function run(action: () => Promise<void>, fallback: string) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const startSetup = () => run(async () => {
    const { secret, otpauthUri } = await authService.startTwoFactorSetup();
    setView({ step: "setup", secret, uri: otpauthUri });
  }, "Couldn't start setup. Please try again.");

  const confirmSetup = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const { backupCodes } = await authService.confirmTwoFactorSetup(code);
    setCode("");
    setView({ step: "codes", codes: backupCodes });
    await refresh();
  }, "Couldn't verify that code."); };

  const disable = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    auth.refreshUser(await authService.disableTwoFactor(password, code));
    toast.show("Two-factor sign-in is off. Other devices have been signed out.");
    reset();
    await refresh();
  }, "Couldn't turn it off."); };

  const regenerate = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const { backupCodes } = await authService.regenerateBackupCodes(password, code);
    setPassword(""); setCode("");
    setView({ step: "codes", codes: backupCodes });
    await refresh();
  }, "Couldn't make new codes."); };

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${what} copied`);
    } catch {
      toast.show("Couldn't copy. Select the text and copy it manually.", { tone: "error" });
    }
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Two-factor sign-in</h2>
            <p className="text-sm text-[var(--w360-text-muted)] mt-1">
              A code from an authenticator app on your phone, as well as your password. Protects your health data even
              if your password is guessed or leaked.
            </p>
          </div>
          {status?.enabled && <Badge tone="success">On</Badge>}
        </div>

        <div className="mt-4">
          {loadError ? (
            <p className="text-sm text-[var(--w360-text-muted)]">
              Couldn't check your two-factor status. <button className="underline font-medium" onClick={() => void refresh()}>Try again</button>
            </p>
          ) : !status ? (
            <p className="text-sm text-[var(--w360-text-muted)]">Checking…</p>
          ) : !status.available ? (
            <p className="text-sm text-[var(--w360-text-muted)]">Not available on this server yet.</p>
          ) : view.step === "setup" ? (
            <form onSubmit={confirmSetup} className="flex flex-col gap-4">
              <ol className="text-sm flex flex-col gap-3 list-decimal pl-5">
                <li>
                  Open an authenticator app (Google Authenticator, Authy, 1Password, Microsoft Authenticator…) and add an
                  account.
                  <div className="mt-2 flex flex-col gap-2">
                    <a href={view.uri} className="text-maroon-700 dark:text-maroon-200 font-medium underline underline-offset-2 w-fit">
                      Open in my authenticator app
                    </a>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="px-3 py-2 rounded-lg bg-[var(--w360-tint)] text-[var(--w360-tint-text)] text-sm tracking-wider break-all select-all">
                        {view.secret.replace(/(.{4})/g, "$1 ").trim()}
                      </code>
                      <Button type="button" variant="ghost" size="sm" onClick={() => copy(view.secret, "Key")}>
                        <Copy size={14} /> Copy key
                      </Button>
                    </div>
                  </div>
                </li>
                <li>Type the 6-digit code it shows to finish.</li>
              </ol>
              <Input
                label="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={error || undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Checking…" : "Turn on"}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel</Button>
              </div>
            </form>
          ) : view.step === "codes" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Save your backup codes</p>
              <p className="text-sm text-[var(--w360-text-muted)]">
                Each works once, if you ever lose your phone. This is the only time they're shown — keep them
                somewhere safe, not in this app.
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {view.codes.map((c) => (
                  <li key={c} className="px-3 py-2 rounded-lg bg-[var(--w360-tint)] text-[var(--w360-tint-text)] font-mono text-sm text-center select-all">
                    {c}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => copy(view.codes.join("\n"), "Codes")}>
                  <Copy size={14} /> Copy all
                </Button>
                <Button type="button" size="sm" onClick={reset}>I've saved them</Button>
              </div>
            </div>
          ) : view.step === "disable" || view.step === "regenerate" ? (
            <form onSubmit={view.step === "disable" ? disable : regenerate} className="flex flex-col gap-4">
              <p className="text-sm text-[var(--w360-text-muted)]">
                {view.step === "disable"
                  ? "To turn it off, confirm with your password and a current code."
                  : "This replaces your current backup codes — the old ones stop working."}
              </p>
              <PasswordField label="Password" value={password} onChange={setPassword} required />
              <Input
                label="Authenticator or backup code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={error || undefined}
                autoComplete="one-time-code"
                required
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant={view.step === "disable" ? "danger" : "primary"} disabled={busy}>
                  {busy ? "Working…" : view.step === "disable" ? "Turn off" : "Make new codes"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel</Button>
              </div>
            </form>
          ) : status.enabled ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--w360-text-muted)]">
                {status.backupCodesRemaining} backup {status.backupCodesRemaining === 1 ? "code" : "codes"} left.
                {status.backupCodesRemaining <= 2 && " Consider making new ones."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setView({ step: "regenerate" })}>New backup codes</Button>
                <Button size="sm" variant="danger" onClick={() => setView({ step: "disable" })}>Turn off</Button>
              </div>
            </div>
          ) : (
            <>
              {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
              <Button size="sm" onClick={startSetup} disabled={busy}>{busy ? "Starting…" : "Set up"}</Button>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function SessionsCard() {
  const { auth } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  async function signOutEverywhere() {
    try {
      await authService.logoutEverywhere();
      auth.logout();
      nav("/login");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't sign out everywhere. Please try again.", { tone: "error" });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <h2 className="font-display text-lg font-semibold">Sessions</h2>
        <p className="text-sm text-[var(--w360-text-muted)] mt-1 mb-4">
          Signed in somewhere you don't recognise, or lost a phone? This ends every session on every device, including
          this one, immediately.
        </p>
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>Sign out everywhere</Button>
        <ConfirmDialog
          open={confirming}
          title="Sign out everywhere?"
          description="You'll be signed out on every device, including this one, and will need to log in again."
          confirmLabel="Sign out everywhere"
          onConfirm={signOutEverywhere}
          onCancel={() => setConfirming(false)}
        />
      </CardBody>
    </Card>
  );
}
