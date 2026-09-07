import { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authService } from "@/services/authService";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return setError("This reset link is invalid or has expired. Please request a new one.");
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError("");
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      nav("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error} required />
        <Button type="submit" fullWidth disabled={loading}>{loading ? "Saving…" : "Save new password"}</Button>
      </form>
    </AuthLayout>
  );
}
