import { FormEvent, useEffect } from "react";
import { useState } from "react";
import { warmUpApi } from "@/services/apiClient";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { OtpInput, type OtpState } from "@/components/ui/OtpInput";
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
  // The authenticator code is six digits (numeric keypad, submits itself); a backup code has letters, so it gets the full keyboard.
  const [useBackup, setUseBackup] = useState(false);
  const [otpState, setOtpState] = useState<OtpState>("idle");
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

  async function verify(value: string) {
    setError("");
    if (!value.trim()) {
      setError(useBackup ? "Enter one of your backup codes." : "Enter the code from your authenticator app.");
      return;
    }
    setOtpState("verifying");
    try {
      const user = await auth.completeTwoFactor(challenge!, value);
      setOtpState("success");
      // A beat to see the tick before the app opens.
      setTimeout(() => finish(user), useBackup ? 0 : 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that code. Please try again.");
      setOtpState("error");
    }
  }

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    void verify(code);
  }

  // Typing again after a wrong code goes back to the plain state. (The six-digit code submits itself: see OtpInput.)
  function onCodeChange(value: string) {
    setCode(value);
    if (otpState === "error" && value) setOtpState("idle");
    if (error && value) setError("");
  }

  if (challenge) {
    return (
      <AuthLayout title="Enter your code" subtitle={useBackup ? "Each backup code works once." : "From your authenticator app."}>
        {/* A different key makes this a new form, so its field is created fresh and takes focus (React would otherwise reuse the email field). */}
        <form key={useBackup ? "backup" : "two-factor"} onSubmit={onSubmitCode} className="flex flex-col gap-4">
          {useBackup ? (
            <>
              <Input
                label="Backup code"
                name="otp"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                error={error || undefined}
                maxLength={20}
                inputMode="text"
                autoComplete="one-time-code"
                enterKeyHint="go"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
              />
              <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Checking…" : "Log in"}</Button>
            </>
          ) : (
            <OtpInput
              label="Authentication code"
              value={code}
              onChange={onCodeChange}
              onComplete={(c) => void verify(c)}
              state={otpState}
              error={error || undefined}
              autoFocus
            />
          )}
          <button
            type="button"
            onClick={() => {
              setUseBackup((v) => !v);
              setCode("");
              setError("");
              setOtpState("idle");
            }}
            className="text-sm font-medium text-maroon-700 dark:text-maroon-200"
          >
            {useBackup ? "Use my authenticator app instead" : "Lost your phone? Use a backup code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError("");
              setOtpState("idle");
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
        <Input label="Email" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
