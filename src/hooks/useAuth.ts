import { useCallback, useEffect, useState } from "react";
import type { User } from "@/types";
import { authService } from "@/services/authService";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => authService.getCachedUser());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!authService.hasSession()) {
      setUser(null);
      setBootstrapping(false);
    } else {
      authService
        .fetchCurrentUser()
        .then((u) => {
          if (!cancelled) setUser(u);
        })
        .catch(() => {
          authService.logout();
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setBootstrapping(false);
        });
    }

    function onSessionExpired() {
      setUser(null);
    }
    window.addEventListener("w360:session-expired", onSessionExpired);

    return () => {
      cancelled = true;
      window.removeEventListener("w360:session-expired", onSessionExpired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authService.login(email, password);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, dob?: string) => {
    setLoading(true);
    try {
      const u = await authService.register(name, email, password, dob);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    const u = await authService.completeOnboarding();
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  // For pages that update the user through a different service (e.g.
  // userService's profile save) but still need the shared session state
  // (greeting, TopBar, etc.) to reflect the change immediately.
  const refreshUser = useCallback((updated: User) => {
    authService.cacheUser(updated);
    setUser(updated);
  }, []);

  return { user, bootstrapping, loading, login, register, completeOnboarding, logout, refreshUser };
}
