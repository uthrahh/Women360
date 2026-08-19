import { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authService } from "@/services/authService";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError("");
    setLoading(true);
    await authService.resetPassword("mock-token", password);
    setLoading(false);
    nav("/login");
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
