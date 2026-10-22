import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { LoadingState } from "@/components/ui/states";
import { roleHome } from "@/lib/roleHome";
import type { Role } from "@/types";

/**
 * Guards a group of routes. The woman's app (`/app`) is for the woman role;
 * `/coach` and `/admin` each need their own role. Someone signed in with a
 * different role is sent to their own home, never shown a screen that would
 * only error. (The server enforces the same rule; this just avoids the dead end.)
 */
export function ProtectedRoute({ role = "woman" }: { role?: Role }) {
  const { auth } = useApp();
  if (auth.bootstrapping) return <LoadingState label="Loading" />;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (auth.user.role !== role) return <Navigate to={roleHome(auth.user)} replace />;
  if (role === "woman" && !auth.user.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
