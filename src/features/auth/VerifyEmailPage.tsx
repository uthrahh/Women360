import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Banner } from "@/components/ui/Banner";
import { buttonClasses } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/states";
import { useApp } from "@/context/AppContext";
import { authService } from "@/services/authService";
import { roleHome } from "@/lib/roleHome";

/** Where the confirmation link in the sign-up email lands. It may be opened signed in or not, on any device. */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { auth } = useApp();
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState("");
  // A link works once, so it is opened once even when React runs effects twice in development.
  const opened = useRef(false);

  useEffect(() => {
    if (!token || opened.current) return;
    opened.current = true;
    authService
      .verifyEmail(token)
      .then(async () => {
        setState("done");
        if (auth.user) auth.refreshUser(await authService.fetchCurrentUser().catch(() => ({ ...auth.user!, emailVerified: true })));
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : "");
        setState("failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const next = auth.user ? { to: roleHome(auth.user), label: "Go to Women360" } : { to: "/login", label: "Sign in" };

  return (
    <AuthLayout title="Confirm your email">
      {state === "working" && <LoadingState label="Confirming your email address" variant="spinner" />}
      {state === "done" && (
        <div className="flex flex-col gap-5">
          <Banner tone="success" title="Your email address is confirmed">
            You can now reset your password with it if you ever forget it.
          </Banner>
          <Link to={next.to} className={buttonClasses({ fullWidth: true })}>{next.label}</Link>
        </div>
      )}
      {state === "failed" && (
        <div className="flex flex-col gap-5">
          <Banner tone="warning" title="That link didn't work">
            {message || "This confirmation link is invalid or has expired."} Sign in and choose "Send the link again" to get a new one.
          </Banner>
          <Link to={next.to} className={buttonClasses({ fullWidth: true, variant: "secondary" })}>{next.label}</Link>
        </div>
      )}
    </AuthLayout>
  );
}
