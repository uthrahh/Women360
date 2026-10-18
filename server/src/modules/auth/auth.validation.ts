import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  // The real rules (length, common passwords, runs, not containing your own
  // name or email) live in lib/passwordPolicy.ts so the person gets the
  // specific reason rather than a generic validation error.
  password: z.string().min(1, "Password is required").max(1024),
  dateOfBirth: z.string().date().optional(),
  // Honeypot — see authService.register.
  website: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "A refresh token is required"),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1, "Password is required").max(1024),
});

// A 6-digit authenticator code or a backup code ("abcde-fghij") — bounded so a
// huge string can't be used to make the server do work.
const secondFactorCode = z.string().trim().min(6, "Enter your code").max(32);

export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: secondFactorCode,
});

export const twoFactorConfirmSchema = z.object({ code: secondFactorCode });

export const twoFactorReauthSchema = z.object({
  password: z.string().min(1, "Enter your password").max(1024),
  code: secondFactorCode,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(1024),
  newPassword: z.string().min(1, "Password is required").max(1024),
});
