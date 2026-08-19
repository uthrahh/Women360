import { useCallback, useEffect, useState } from "react";
import type { User } from "@/types";
import { authService } from "@/services/authService";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => authService.getSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(authService.getSession());
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

  const register = useCallback(async (name: string, email: string, dob: string) => {
    setLoading(true);
    try {
      const u = await authService.register(name, email, dob);
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

  return { user, loading, login, register, completeOnboarding, logout };
}
