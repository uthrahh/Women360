import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { NewPasswordField } from "@/components/ui/NewPasswordField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { passwordAcceptable } from "@/lib/passwordPolicy";
import { authService } from "@/services/authService";
import { useApp } from "@/context/AppContext";
import { roleHome } from "@/lib/roleHome";

/**
 * The one-time link a coach sends a client (or an administrator sends a new coach). She sees whose record it is, adds a sign-in
 * address if her coach didn't have one, chooses a password, and is signed in.
 */
export default function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<{ name: string; role: string; email: string | null } | null>(null);
  const [problem, setProblem] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { auth } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    if (!token) return setProblem("This link is incomplete. Ask for a new one.");
    authService
      .peekInvite(token)
      .then(setInvite)
      .catch((err) => setProblem(err instanceof Error ? err.message : "This link doesn't work. Ask for a new one."));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setError("");
    if (!invite.email && !email.trim()) return setError("Enter the email address you'll sign in with.");
    if (!passwordAcceptable(password, { email: invite.email ?? email, name: invite.name })) return setError("Choose a stronger password.");
    if (!agreed) return setError("Please read and agree to the privacy summary.");
    setBusy(true);
    try {
      const user = await authService.claimInvite(token, { password, email: invite.email ? null : email.trim() });
      auth.refreshUser(user);
      nav(roleHome(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (problem) {
    return (
      <AuthLayout title="This link doesn't work">
        <p className="text-sm text-[var(--w360-text-muted)]">{problem}</p>
        <Link to="/login" className="text-sm font-medium text-maroon-700 dark:text-maroon-300 mt-4 inline-block">Go to sign in</Link>
      </AuthLayout>
    );
  }
  if (!invite) return <AuthLayout title="Checking your link…"><p className="sr-only">Checking your link</p></AuthLayout>;

  const coach = invite.role === "COACH";
  return (
    <AuthLayout title={`Welcome, ${invite.name.split(" ")[0]}`} subtitle={coach ? "Set up your coach account." : "Your coach started your Women360 record. Set a password to use it yourself."}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {invite.email ? (
          <p className="text-sm">You'll sign in as <span className="font-medium">{invite.email}</span>.</p>
        ) : (
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        <NewPasswordField label="Password" value={password} onChange={setPassword} context={{ email: invite.email ?? email, name: invite.name }} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>
            I've read the <Link to="/privacy" target="_blank" className="font-medium text-maroon-700 dark:text-maroon-300">privacy summary</Link>
            {coach ? "." : ", including what my coaches can see."}
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Setting up…" : "Continue"}</Button>
      </form>
    </AuthLayout>
  );
}
