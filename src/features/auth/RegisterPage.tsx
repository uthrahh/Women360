import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/Input";
import { NewPasswordField } from "@/components/ui/NewPasswordField";
import { DateWheel } from "@/components/ui/DateWheel";
import { Banner } from "@/components/ui/Banner";
import { passwordAcceptable } from "@/lib/passwordPolicy";
import { oldEnough, plausibleBirthDate, rememberDeclined, wasDeclined } from "@/lib/ageGate";
import { localDateISO } from "@/services/mappers";
import { Button, buttonClasses } from "@/components/ui/Button";
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
  // The age gate is neutral: it asks for a date of birth without saying what age is needed, and after a "no" it
  // doesn't invite another try on this device.
  const [declined, setDeclined] = useState(wasDeclined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const today = localDateISO();
    const errs: Record<string, string> = {};
    if (!name) errs.name = "Enter your full name.";
    if (!email.includes("@")) errs.email = "Enter a valid email.";
    if (!dob) errs.dob = "Choose your date of birth.";
    else if (!plausibleBirthDate(dob, today)) errs.dob = "Please choose a real date of birth.";
    if (!passwordAcceptable(password, { email, name })) errs.password = "Choose a password the line under the field is happy with, or tap Suggest one.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!oldEnough(dob, today)) {
      rememberDeclined();
      setDeclined(true);
      return;
    }
    try {
      await auth.register(name, email, password, dob, website);
      nav("/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setErrors({ email: "An account with this email already exists." });
      } else if (err instanceof ApiError && err.code === "FORBIDDEN") {
        rememberDeclined();
        setDeclined(true);
      } else {
        setErrors({ password: err instanceof Error ? err.message : "Couldn't create your account. Please try again." });
      }
    }
  }

  if (declined) {
    return (
      <AuthLayout title="Create your account">
        <div className="flex flex-col gap-5">
          <Banner tone="info" title="Sorry, Women360 isn't available to you">
            We're not able to create an account with the details given.
          </Banner>
          <Link to="/" className={buttonClasses({ variant: "secondary", fullWidth: true })}>Back to the home page</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Takes about two minutes.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Input label="Full name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input label="Email" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <DateWheel label="Date of birth" value={dob} onChange={setDob} error={errors.dob} />
        <NewPasswordField label="Password" value={password} onChange={setPassword} context={{ email, name }} error={errors.password} />
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <Button type="submit" fullWidth disabled={auth.loading}>{auth.loading ? "Creating account…" : "Create account"}</Button>
        <p className="text-xs text-[var(--w360-text-muted)] text-center">
          By creating an account you agree to the <Link to="/terms" className="underline underline-offset-2">terms of use</Link> and have read the <Link to="/privacy" className="underline underline-offset-2">privacy summary</Link>.
        </p>
      </form>
      <p className="text-sm text-[var(--w360-text-muted)] mt-6 text-center">
        Already have an account? <Link to="/login" className="font-medium text-maroon-700 dark:text-maroon-300">Log in</Link>
      </p>
    </AuthLayout>
  );
}
