import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { LoadingState } from "@/components/ui/states";

export function ProtectedRoute() {
  const { auth } = useApp();
  if (auth.bootstrapping) return <LoadingState label="Loading" />;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!auth.user.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
