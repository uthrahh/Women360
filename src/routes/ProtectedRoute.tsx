import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export function ProtectedRoute() {
  const { auth } = useApp();
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!auth.user.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
