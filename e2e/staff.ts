import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { APIRequestContext, Browser, Page } from "@playwright/test";

/**
 * Coach and administrator accounts for a browser test. The API can't create either (registration always makes a woman, and
 * administrators are made only by an operator), so, exactly like the server's own tests, a fresh account is registered through
 * the API and its role is set directly in this run's test database. Test-only: nothing here ships.
 */
const API = "http://localhost:4000/api/v1";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Locally the API reads server/.env; read the same line from it (never printed).
  const env = fs.readFileSync(path.resolve("server/.env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("No DATABASE_URL for the browser tests");
  return line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
}

async function setRole(userId: string, role: "COACH" | "ADMIN") {
  const require = createRequire(path.resolve("server/package.json"));
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  try {
    await prisma.user.update({ where: { id: userId }, data: { role, onboarded: true } });
  } finally {
    await prisma.$disconnect();
  }
}

export interface Staff {
  name: string;
  email: string;
  password: string;
  token: string;
}

export async function makeStaff(request: APIRequestContext, role: "COACH" | "ADMIN", name: string): Promise<Staff> {
  const email = `e2e.${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `${crypto.randomBytes(9).toString("base64url")}-Aa9!`;
  const res = await request.post(`${API}/auth/register`, { data: { name, email, password, dateOfBirth: "1985-03-10" } });
  if (res.status() !== 201) throw new Error(`register ${role}: ${res.status()}`);
  const body = await res.json();
  await setRole(body.data.user.id, role);
  // Sign in again so the token carries the new role.
  const login = await request.post(`${API}/auth/login`, { data: { email, password } });
  const token = (await login.json()).data.accessToken as string;
  return { name, email, password, token };
}

/** A separate browser window signed in as this staff account. */
export async function signInPage(browser: Browser, s: Staff): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(s.email);
  await page.getByLabel("Password", { exact: true }).fill(s.password);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await page.waitForURL(/\/(coach|admin)/);
  return page;
}
