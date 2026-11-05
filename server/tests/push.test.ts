import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { runReminderTick } from "@/modules/push/dispatch";
import { inWindow, isTrustedPushEndpoint, localClock, parseReminder, parseTimeOfDay } from "@/modules/push/schedule";
import type { PushPayload, SendResult, Sender } from "@/modules/push/sender";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

async function signUp(label: string, options: { demo?: boolean } = {}) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Reminder Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  const id = res.body.data.user.id as string;
  if (options.demo) await prisma.user.update({ where: { id }, data: { isDemo: true } });
  return { id, token: res.body.data.accessToken as string };
}
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const newEndpoint = () => `https://fcm.googleapis.com/fcm/send/${Math.random().toString(36).slice(2)}${Date.now()}`;

async function subscribe(token: string, endpoint = newEndpoint(), timezone = "Asia/Kolkata") {
  const res = await request(app).post("/api/v1/push/subscribe").set(as(token)).send({ endpoint, keys: KEYS, timezone });
  return { res, endpoint };
}

/** A fake push service that records what it was asked to send and answers as told. */
function fakeSender(answer: (endpoint: string) => SendResult = () => "sent") {
  const calls: { endpoint: string; payload: PushPayload }[] = [];
  const send: Sender = async (target, payload) => {
    calls.push({ endpoint: target.endpoint, payload });
    return answer(target.endpoint);
  };
  return { send, calls, to: (endpoint: string) => calls.filter((c) => c.endpoint === endpoint) };
}

/** 07:05 on today's date in India (01:35 UTC), so "7:00 AM" is five minutes old. */
function sevenOhFiveInIndia(plusMinutes = 0) {
  const t = new Date();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 1, 35 + plusMinutes));
}
const indiaDay = () => localClock(sevenOhFiveInIndia(), "Asia/Kolkata").day;

describe("push scheduling rules", () => {
  it("reads a reminder time and nothing else", () => {
    expect(parseReminder("7:00 AM")).toBe(420);
    expect(parseReminder("12:30 am")).toBe(30);
    expect(parseReminder("12:00 PM")).toBe(720);
    expect(parseReminder("9:15PM")).toBe(21 * 60 + 15);
    for (const bad of ["", null, undefined, "whenever", "13:00 PM", "0:30 AM", "7:60 AM", "07:00"]) expect(parseReminder(bad as string)).toBeNull();
    expect(parseTimeOfDay("08:00")).toBe(480);
    expect(parseTimeOfDay("24:00")).toBeNull();
  });

  it("works out the day and time where she is", () => {
    expect(localClock(new Date("2026-11-05T01:35:00Z"), "Asia/Kolkata")).toEqual({ day: "2026-11-05", minutes: 7 * 60 + 5 });
    expect(localClock(new Date("2026-11-05T20:00:00Z"), "Asia/Kolkata")).toEqual({ day: "2026-11-06", minutes: 60 + 30 });
    expect(localClock(new Date("2026-11-05T03:00:00Z"), "America/Los_Angeles")).toEqual({ day: "2026-11-04", minutes: 19 * 60 });
    expect(localClock(new Date("2026-11-05T00:00:00Z"), "Not/AZone")).toEqual({ day: "2026-11-05", minutes: 0 });
  });

  it("sends from the reminder time until twenty minutes after, not before and not later", () => {
    expect(inWindow(419, 420)).toBe(false);
    expect(inWindow(420, 420)).toBe(true);
    expect(inWindow(440, 420)).toBe(true);
    expect(inWindow(441, 420)).toBe(false);
  });

  it("only sends to real push services, never to an address the person chose", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://web.push.apple.com/abc",
    ]) expect(isTrustedPushEndpoint(ok)).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/fcm.googleapis.com",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "not a url",
    ]) expect(isTrustedPushEndpoint(bad)).toBe(false);
  });
});

describe("push device registration", () => {
  it("is switched on and advertises the public key", async () => {
    const res = await request(app).get("/api/v1/config");
    expect(res.body.data.pushPublicKey).toBe(process.env.VAPID_PUBLIC_KEY);
  });

  it("needs a signed-in person", async () => {
    const res = await request(app).post("/api/v1/push/subscribe").send({ endpoint: newEndpoint(), keys: KEYS, timezone: "Asia/Kolkata" });
    expect(res.status).toBe(401);
  });

  it("registers a device, and registering it again only refreshes it", async () => {
    const { id, token } = await signUp("push-reg");
    const { res, endpoint } = await subscribe(token);
    expect(res.status).toBe(200);
    expect((await subscribe(token, endpoint, "Europe/London")).res.status).toBe(200);
    const rows = await prisma.pushSubscription.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].timezone).toBe("Europe/London");
  });

  it("refuses an address that isn't a push service, a bad time zone, and missing keys", async () => {
    const { token } = await signUp("push-bad");
    expect((await subscribe(token, "https://169.254.169.254/latest/meta-data")).res.status).toBe(422);
    expect((await subscribe(token, newEndpoint(), "Mars/Olympus")).res.status).toBe(422);
    const noKeys = await request(app).post("/api/v1/push/subscribe").set(as(token)).send({ endpoint: newEndpoint(), timezone: "Asia/Kolkata" });
    expect(noKeys.status).toBe(422);
  });

  it("moves a device to whoever signs in on it now, so the wrong person is never reminded", async () => {
    const first = await signUp("push-share-a");
    const second = await signUp("push-share-b");
    const { endpoint } = await subscribe(first.token);
    await subscribe(second.token, endpoint);
    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row?.userId).toBe(second.id);
  });

  it("keeps only the newest ten devices", async () => {
    const { id, token } = await signUp("push-cap");
    for (let i = 0; i < 12; i++) await subscribe(token);
    expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(10);
  });

  it("removes only her own device", async () => {
    const mine = await signUp("push-un-a");
    const other = await signUp("push-un-b");
    const { endpoint } = await subscribe(mine.token);
    await request(app).post("/api/v1/push/unsubscribe").set(as(other.token)).send({ endpoint });
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
    expect((await request(app).post("/api/v1/push/unsubscribe").set(as(mine.token)).send({ endpoint })).status).toBe(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });

  it("is not offered to the shared demonstration accounts", async () => {
    const { token } = await signUp("push-demo", { demo: true });
    expect((await subscribe(token)).res.status).toBe(403);
  });

  it("is deleted with the account and listed in her data export without secrets", async () => {
    const { id, token } = await signUp("push-export");
    const { endpoint } = await subscribe(token);
    const exported = await request(app).get("/api/v1/users/me/export").set(as(token));
    expect(exported.body.data.reminderDevices).toEqual([expect.objectContaining({ timezone: "Asia/Kolkata", service: "fcm.googleapis.com" })]);
    expect(JSON.stringify(exported.body)).not.toContain(endpoint);
    expect(JSON.stringify(exported.body)).not.toContain(KEYS.auth);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });
});

describe("closed-app reminders", () => {
  const makeHabit = (token: string, body: object) => request(app).post("/api/v1/habits").set(as(token)).send(body);

  it("sends a habit's reminder once, at her time of day, with no health detail on the lock screen", async () => {
    const { token } = await signUp("push-habit");
    const { endpoint } = await subscribe(token);
    const habit = await makeHabit(token, { title: "Take my iron tablet", reminder: "7:00 AM" });
    expect(habit.status).toBe(201);

    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(-10), fake.send); // 06:55, too early
    expect(fake.to(endpoint)).toHaveLength(0);

    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    await runReminderTick(sevenOhFiveInIndia(1), fake.send); // the next minute's tick must not repeat it
    const sent = fake.to(endpoint);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload.url).toBe("/app/habits");
    expect(sent[0].payload.tag).toBe(`habit-${habit.body.data.id}`);
    expect(JSON.stringify(sent[0].payload)).not.toMatch(/iron|tablet/i);
  });

  it("does not send a reminder that is more than twenty minutes late", async () => {
    const { token } = await signUp("push-late");
    const { endpoint } = await subscribe(token);
    await makeHabit(token, { title: "Stretch", reminder: "7:00 AM" });
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(20), fake.send); // 07:25
    expect(fake.to(endpoint)).toHaveLength(0);
  });

  it("reads the time on her own clock, not the server's", async () => {
    const { token } = await signUp("push-zone");
    const london = await subscribe(token, newEndpoint(), "Europe/London");
    await makeHabit(token, { title: "Walk", reminder: "7:00 AM" });
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send); // 07:05 in India is the small hours in London
    expect(fake.to(london.endpoint)).toHaveLength(0);
  });

  it("stays quiet for a habit already done today, and for one whose week is met", async () => {
    const { token } = await signUp("push-done");
    const { endpoint } = await subscribe(token);
    const done = await makeHabit(token, { title: "Vitamin", reminder: "7:00 AM" });
    await request(app).put(`/api/v1/habits/${done.body.data.id}/logs/${indiaDay()}?today=${indiaDay()}`).set(as(token)).send({});
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    expect(fake.to(endpoint)).toHaveLength(0);
  });

  it("stays quiet for a habit with no reminder, one in older free text, and an archived one", async () => {
    const { token } = await signUp("push-none");
    const { endpoint } = await subscribe(token);
    await makeHabit(token, { title: "No reminder" });
    await makeHabit(token, { title: "Old style", reminder: "in the morning" });
    const archived = await makeHabit(token, { title: "Archived", reminder: "7:00 AM" });
    await request(app).patch(`/api/v1/habits/${archived.body.data.id}`).set(as(token)).send({ archived: true });
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    expect(fake.to(endpoint)).toHaveLength(0);
  });

  it("only reminds the person it belongs to", async () => {
    const a = await signUp("push-iso-a");
    const b = await signUp("push-iso-b");
    const deviceA = await subscribe(a.token);
    const deviceB = await subscribe(b.token);
    await makeHabit(a.token, { title: "Mine", reminder: "7:00 AM" });
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    expect(fake.to(deviceA.endpoint)).toHaveLength(1);
    expect(fake.to(deviceB.endpoint)).toHaveLength(0);
  });

  it("sends to every device she has, once each", async () => {
    const { token } = await signUp("push-two");
    const phone = await subscribe(token);
    const laptop = await subscribe(token);
    await makeHabit(token, { title: "Water", reminder: "7:00 AM" });
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    expect(fake.to(phone.endpoint)).toHaveLength(1);
    expect(fake.to(laptop.endpoint)).toHaveLength(1);
  });

  it("forgets a device the browser says is gone, and tries again next minute if nothing got through", async () => {
    const { id, token } = await signUp("push-fail");
    const { endpoint } = await subscribe(token);
    await makeHabit(token, { title: "Walk", reminder: "7:00 AM" });

    const failing = fakeSender(() => "failed");
    await runReminderTick(sevenOhFiveInIndia(), failing.send);
    expect(failing.to(endpoint)).toHaveLength(1);
    expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(1); // a hiccup keeps the device

    const working = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(1), working.send); // the retry
    expect(working.to(endpoint)).toHaveLength(1);

    const gone = fakeSender(() => "gone");
    await makeHabit(token, { title: "Stretch", reminder: "7:00 AM" });
    await runReminderTick(sevenOhFiveInIndia(2), gone.send);
    expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(0);
  });

  it("reminds about a medicine dose at its time, unless she already recorded one", async () => {
    const quiet = await signUp("push-med-a");
    const noisy = await signUp("push-med-b");
    const quietDevice = await subscribe(quiet.token);
    const noisyDevice = await subscribe(noisy.token);
    for (const person of [quiet, noisy]) {
      const med = await request(app).post("/api/v1/health/medications").set(as(person.token)).send({ name: "Levothyroxine", dose: "50mcg", schedule: "Once daily", times: ["07:00"] });
      expect(med.status).toBe(201);
      if (person === quiet) {
        await prisma.medicationLog.create({ data: { medicationId: med.body.data.id, userId: person.id, scheduledFor: new Date(), status: "TAKEN" } });
      }
    }
    const fake = fakeSender();
    await runReminderTick(sevenOhFiveInIndia(), fake.send);
    expect(fake.to(quietDevice.endpoint)).toHaveLength(0);
    const sent = fake.to(noisyDevice.endpoint);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload.url).toBe("/app/health");
    expect(JSON.stringify(sent[0].payload)).not.toContain("Levothyroxine");
  });
});
