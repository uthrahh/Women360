import { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";

export default function LoginPage() {
  const { auth } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("sarah.menon@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    const user = await auth.login(email, password);
    nav(user.onboarded ? "/app/dashboard" : "/onboarding");
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see your latest health snapshot.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error || undefined} required />
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
