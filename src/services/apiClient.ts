/**
 * Real API client, talking to the Express/Prisma backend in server/.
 *
 * Every service in `src/services` calls `request()` here instead of the
 * backend directly, so auth headers, token refresh, and the response
 * envelope are handled in exactly one place.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

const SIMULATED_LATENCY_MS = 280;

// Still used by services not yet cut over to the real backend.
export function delay<T>(value: T, ms: number = SIMULATED_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(message: string, public status = 500, public code?: string) {
    super(message);
  }
}

const TOKENS_KEY = "w360_session_tokens";

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): Tokens | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export function setTokens(tokens: Tokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Envelope<never>;
    if (body.error) return new ApiError(body.error.message, res.status, body.error.code);
  } catch {
    // response body wasn't JSON — fall through to a generic message
  }
  return new ApiError("Something went wrong. Please try again.", res.status);
}

// Shared across concurrent callers so two requests that both hit a 401 at
// the same moment trigger exactly one /auth/refresh call, not a race that
// rotates the refresh token out from under the loser.
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new ApiError("No session to refresh.", 401);

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) throw await parseError(res);

  const body = (await res.json()) as Envelope<{ accessToken: string; refreshToken: string }>;
  setTokens({ accessToken: body.data!.accessToken, refreshToken: body.data!.refreshToken });
  return body.data!.accessToken;
}

function getSharedRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const tokens = getTokens();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && tokens && !isRetry) {
    try {
      await getSharedRefresh();
    } catch {
      clearTokens();
      window.dispatchEvent(new Event("w360:session-expired"));
      throw new ApiError("Your session has expired. Please sign in again.", 401, "UNAUTHORIZED");
    }
    return request<T>(path, init, true);
  }

  if (res.status === 401) {
    clearTokens();
    window.dispatchEvent(new Event("w360:session-expired"));
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as Envelope<T>;
  return body.data as T;
}
