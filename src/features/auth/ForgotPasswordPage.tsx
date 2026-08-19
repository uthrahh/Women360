import { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authService } from "@/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await authService.requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send a reset link to your email.">
      {sent ? (
        <div className="text-sm bg-maroon-50 dark:bg-white/5 border border-maroon-200 dark:border-white/10 rounded p-4">
          If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" fullWidth disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <p className="text-sm text-[var(--w360-text-muted)] mt-6 text-center">
        <Link to="/login" className="font-medium text-maroon-700 dark:text-maroon-200">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
