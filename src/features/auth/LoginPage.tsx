import { FormEvent, useEffect } from "react";
import { useState } from "react";
import { warmUpApi } from "@/services/apiClient";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { isTwoFactorChallenge, type TwoFactorChallenge } from "@/services/authService";
import { roleHome } from "@/lib/roleHome";
import type { User } from "@/types";

export default function LoginPage() {
  const { auth } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Set once the password was right but a code is still needed.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState("");
  useEffect(warmUpApi, []);

  const finish = (user: User) => nav(roleHome(user));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    try {
      const result = await auth.login(email, password);
      if (isTwoFactorChallenge(result)) {
        setChallenge(result);
        return;
      }
      finish(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in. Please try again.");
    }
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Enter the code from your authenticator app.");
      return;
    }
    try {
      finish(await auth.completeTwoFactor(challenge!, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that code. Please try again.");
    }
  }

  if (challenge) {
    return (
      <AuthLayout title="Enter your code" subtitle="Open your authenticator app and type the 6-digit code for Women360.">
        <form onSubmit={onSubmitCode} className="flex flex-col gap-4">
          <Input
            label="Authentication code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error || undefined}
            hint="Lost your phone? Use one of your backup codes instead."
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            required
          />
          <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Checking…" : "Verify and log in"}</Button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError("");
            }}
            className="text-sm text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
          >
            Back to log in
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see your latest health snapshot.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField label="Password" value={password} onChange={setPassword} error={error || undefined} required />
        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-xs font-medium text-maroon-700 dark:text-maroon-200">Forgot password?</Link>
        </div>
        <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="text-sm text-[var(--w360-text-muted)] mt-6 text-center">
        New to Women360? <Link to="/register" className="font-medium text-maroon-700 dark:text-maroon-200">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
