import { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { passwordAcceptable } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { ApiError } from "@/services/apiClient";

export default function RegisterPage() {
  const { auth } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  // Honeypot: invisible to people, tempting to scripts. See authService.register on the server.
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name) errs.name = "Enter your full name.";
    if (!email.includes("@")) errs.email = "Enter a valid email.";
    if (!dob) errs.dob = "Enter your date of birth.";
    if (!passwordAcceptable(password, { email, name })) errs.password = "Choose a password that meets every rule below.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await auth.register(name, email, password, dob, website);
      nav("/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setErrors({ email: "An account with this email already exists." });
      } else {
        setErrors({ password: err instanceof Error ? err.message : "Couldn't create your account. Please try again." });
      }
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Takes about two minutes.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <Input label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} error={errors.dob} required />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          policyContext={{ email, name }}
          required
        />
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="text-sm text-[var(--w360-text-muted)] mt-6 text-center">
        Already have an account? <Link to="/login" className="font-medium text-maroon-700 dark:text-maroon-200">Log in</Link>
      </p>
    </AuthLayout>
  );
}
