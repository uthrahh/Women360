/**
 * Mock API client.
 *
 * Every service in `src/services` talks to this module instead of touching
 * mock data directly. When the real backend is ready, swap the body of
 * `request()` for a `fetch()` call against the REST API — no feature or
 * component code needs to change, because they only ever call the
 * service functions, never this file.
 */

const SIMULATED_LATENCY_MS = 280;

export function delay<T>(value: T, ms: number = SIMULATED_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/**
 * Placeholder for the future real request function:
 *
 * export async function request<T>(path: string, init?: RequestInit): Promise<T> {
 *   const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
 *     ...init,
 *     headers: { "Content-Type": "application/json", ...init?.headers },
 *   });
 *   if (!res.ok) throw new ApiError(await res.text(), res.status);
 *   return res.json();
 * }
 */
