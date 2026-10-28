import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { outbox } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

const app = createApp();
const PASSWORD = "a-long-enough-password";

let ipCounter = 100;
let ip: string;
beforeEach(() => {
  ip = `203.0.113.${ipCounter++}`;
  outbox.length = 0;
});

const api = (path: string) => request(app).post(`/api/v1${path}`).set("X-Forwarded-For", ip);
const uniqueEmail = () => `reset.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
const waitForMail = async (to: string) => {
  // The send is not awaited by the request, so give it a moment to land.
  for (let i = 0; i < 40; i++) {
    const mail = outbox.find((m) => m.to === to);
    if (mail) return mail;
    await new Promise((r) => setTimeout(r, 25));
  }
  return undefined;
};

describe("password reset email", () => {
  it("emails a one-time link that really resets the password", async () => {
    const email = uniqueEmail();
    expect((await api("/auth/register").send({ name: "Reset Tester", email, password: PASSWORD })).status).toBe(201);

    const res = await api("/auth/password-reset/request").send({ email });
    expect(res.status).toBe(200);

    const mail = await waitForMail(email);
    expect(mail).toBeDefined();
    expect(mail!.subject).toMatch(/reset/i);
    const token = /reset-password\?token=([0-9a-f]{64})/.exec(mail!.text)?.[1];
    expect(token).toBeDefined();
    // The same link is in the HTML version, and the message never contains the password.
    expect(mail!.html).toContain(token!);
    expect(mail!.text).not.toContain(PASSWORD);

    const newPassword = "a-brand-new-passphrase";
    expect((await api("/auth/password-reset/confirm").send({ token, newPassword })).status).toBe(200);
    expect((await api("/auth/login").send({ email, password: newPassword })).status).toBe(200);
    // One use only.
    expect((await api("/auth/password-reset/confirm").send({ token, newPassword: "another-new-passphrase" })).status).toBe(401);
  });

  it("answers the same way for an address with no account, and sends nothing", async () => {
    const email = uniqueEmail();
    const res = await api("/auth/password-reset/request").send({ email });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 300));
    expect(outbox.find((m) => m.to === email)).toBeUndefined();
    expect(await prisma.passwordResetToken.count({ where: { user: { email } } })).toBe(0);
  });

  it("does not email a deleted account", async () => {
    const email = uniqueEmail();
    await api("/auth/register").send({ name: "Gone Tester", email, password: PASSWORD });
    await prisma.user.update({ where: { email }, data: { deletedAt: new Date() } });
    expect((await api("/auth/password-reset/request").send({ email })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 300));
    expect(outbox.find((m) => m.to === email)).toBeUndefined();
  });
});
