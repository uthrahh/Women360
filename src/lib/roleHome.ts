import type { Role, User } from "@/types";

/** Where each kind of account lands after signing in. */
export function roleHome(user: Pick<User, "role" | "onboarded">): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "coach") return "/coach";
  return user.onboarded ? "/app/dashboard" : "/onboarding";
}

export const STAFF_ROLES: Role[] = ["admin", "coach"];
