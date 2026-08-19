import { delay } from "./apiClient";
import type { User } from "@/types";
import { mockUser } from "@/mock/seed";

const STORAGE_KEY = "w360_session";

export const authService = {
  async login(email: string, _password: string): Promise<User> {
    await delay(null, 500);
    const user: User = { ...mockUser, email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },
  async register(name: string, email: string, dateOfBirth: string): Promise<User> {
    await delay(null, 600);
    const user: User = { ...mockUser, name, email, dateOfBirth, onboarded: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },
  async requestPasswordReset(_email: string): Promise<void> {
    await delay(null, 500);
  },
  async resetPassword(_token: string, _newPassword: string): Promise<void> {
    await delay(null, 500);
  },
  async completeOnboarding(): Promise<User> {
    const current = authService.getSession();
    const user = { ...(current ?? mockUser), onboarded: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    await delay(null, 300);
    return user;
  },
  logout() {
    localStorage.removeItem(STORAGE_KEY);
  },
  getSession(): User | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
};
