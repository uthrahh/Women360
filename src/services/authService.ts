import { clearTokens, getTokens, request, setTokens } from "./apiClient";
import type { User } from "@/types";
import { toFrontendUser } from "./mappers";
import { randomDevicePassword } from "@/lib/devicePassword";

const USER_CACHE_KEY = "w360_session_user";
const DEVICE_CREDENTIALS_KEY = "w360_device_credentials";

interface AuthResponse {
  user: Parameters<typeof toFrontendUser>[0];
  accessToken: string;
  refreshToken: string;
}

// A correct password for an account with two-factor on doesn't sign anyone in;
// it returns this, to be traded for a session together with a code.
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export function isTwoFactorChallenge(result: User | TwoFactorChallenge): result is TwoFactorChallenge {
  return "twoFactorRequired" in result && result.twoFactorRequired === true;
}

export interface TwoFactorStatus {
  available: boolean;
  enabled: boolean;
  backupCodesRemaining: number;
}

function cacheUser(user: User): void {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

function persistSession(res: AuthResponse): User {
  setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  const user = toFrontendUser(res.user);
  cacheUser(user);
  return user;
}

interface DeviceCredentials {
  email: string;
  password: string;
}

function getDeviceCredentials(): DeviceCredentials | null {
  const raw = localStorage.getItem(DEVICE_CREDENTIALS_KEY);
  return raw ? (JSON.parse(raw) as DeviceCredentials) : null;
}

function saveDeviceCredentials(creds: DeviceCredentials): void {
  localStorage.setItem(DEVICE_CREDENTIALS_KEY, JSON.stringify(creds));
}

export const authService = {
  async login(email: string, password: string): Promise<User | TwoFactorChallenge> {
    const res = await request<AuthResponse | TwoFactorChallenge>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if ("twoFactorRequired" in res && res.twoFactorRequired) return res;
    return persistSession(res as AuthResponse);
  },

  async completeTwoFactorLogin(challengeToken: string, code: string): Promise<User> {
    const res = await request<AuthResponse>("/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    });
    return persistSession(res);
  },

  // Changes the password, ends every other session, and keeps this device
  // signed in with the fresh session the server hands back.
  async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    const res = await request<AuthResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return persistSession(res);
  },

  // Ends every session on every device, this one included.
  async logoutEverywhere(): Promise<void> {
    await request("/auth/logout-all", { method: "POST" });
    clearTokens();
    localStorage.removeItem(USER_CACHE_KEY);
  },

  getTwoFactorStatus: () => request<TwoFactorStatus>("/auth/2fa"),
  startTwoFactorSetup: () => request<{ secret: string; otpauthUri: string }>("/auth/2fa/setup", { method: "POST" }),
  confirmTwoFactorSetup: (code: string) =>
    request<{ backupCodes: string[] }>("/auth/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) }),
  regenerateBackupCodes: (password: string, code: string) =>
    request<{ backupCodes: string[] }>("/auth/2fa/backup-codes", { method: "POST", body: JSON.stringify({ password, code }) }),
  // Turning it off ends other sessions server-side and returns a fresh one.
  async disableTwoFactor(password: string, code: string): Promise<User> {
    const res = await request<AuthResponse>("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password, code }),
    });
    return persistSession(res);
  },

  async register(name: string, email: string, password: string, dateOfBirth?: string, website?: string): Promise<User> {
    const res = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, dateOfBirth: dateOfBirth || undefined, website: website || undefined }),
    });
    return persistSession(res);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await request("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await request("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  },

  async completeOnboarding(): Promise<User> {
    const apiUser = await request<AuthResponse["user"]>("/auth/onboarding/complete", { method: "POST" });
    const user = toFrontendUser(apiUser);
    cacheUser(user);
    return user;
  },

  // Best-effort: revokes the refresh token server-side, but local logout
  // (clearing storage) never waits on the network.
  logout(): void {
    const tokens = getTokens();
    clearTokens();
    localStorage.removeItem(USER_CACHE_KEY);
    if (tokens) {
      request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => {
        // Already logged out locally; a failed revoke isn't actionable here.
      });
    }
  },

  hasSession(): boolean {
    return getTokens() !== null;
  },

  // Synchronous cache for instant paint before the bootstrap fetch resolves.
  getCachedUser(): User | null {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },

  async fetchCurrentUser(): Promise<User> {
    const apiUser = await request<AuthResponse["user"]>("/auth/me");
    const user = toFrontendUser(apiUser);
    cacheUser(user);
    return user;
  },

  // For pages (e.g. Settings) that update the user via a different service
  // (userService) but still need the shared session cache/state to reflect it.
  cacheUser,

  // Testing-phase mode (VITE_DEVICE_ONLY_MODE): no login screen — each
  // device gets its own throwaway account, created once and reused from
  // then on via credentials kept in this device's own storage. Still a
  // real account on the real backend, so every other feature (insights,
  // reports, etc.) works exactly as it does for a normal signed-in user;
  // reinstalling the app starts a fresh account since storage is wiped.
  async ensureDeviceAccount(): Promise<User> {
    const existing = getDeviceCredentials();
    if (existing) {
      const result = await this.login(existing.email, existing.password);
      // A throwaway device account has no way to type a code; it's never given
      // a Security tab, so this only guards against it being enabled elsewhere.
      if (isTwoFactorChallenge(result)) throw new Error("This device account needs a sign-in code it can't provide.");
      return result;
    }

    const id = crypto.randomUUID();
    const creds = { email: `device-${id}@women360.local`, password: randomDevicePassword() };
    const user = await this.register("Me", creds.email, creds.password);
    saveDeviceCredentials(creds);
    return this.completeOnboarding().catch(() => user);
  },
};
