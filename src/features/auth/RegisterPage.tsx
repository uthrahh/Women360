import { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";

export default function RegisterPage() {
  const { auth } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name) errs.name = "Enter your full name.";
    if (!email.includes("@")) errs.email = "Enter a valid email.";
    if (!dob) errs.dob = "Enter your date of birth.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await auth.register(name, email, dob);
    nav("/onboarding");
  }

  return (
    <AuthLayout title="Create your account" subtitle="Takes about two minutes.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <Input label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} error={errors.dob} required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters." required />
        <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="text-sm text-[var(--w360-text-muted)] mt-6 text-center">
        Already have an account? <Link to="/login" className="font-medium text-maroon-700 dark:text-maroon-200">Log in</Link>
      </p>
    </AuthLayout>
  );
}
