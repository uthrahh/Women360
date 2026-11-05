import { describe, expect, it } from "vitest";
import { statusRows } from "./statusRows";
import type { SystemStatus } from "@/types";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const healthy: SystemStatus = {
  checkedAt: "2026-11-05T12:00:00Z",
  environment: "production",
  startedAt: "2026-11-05T11:55:00Z",
  database: { ok: true, ms: 12 },
  email: { configured: true, provider: "brevo", from: "Women360 <admin.women360@gmail.com>" },
  reminders: { configured: true, lastCheckAt: "2026-11-05T11:59:30Z" },
  clinicalContent: false,
  twoFactorAvailable: false,
  backup: { lastVerifiedRestoreAt: "2026-11-05T03:00:00Z", tables: 42, rows: 24681, reporting: true },
};
const level = (rows: ReturnType<typeof statusRows>, label: RegExp) => rows.find((r) => label.test(r.label))!.level;

describe("service status wording", () => {
  it("calls a fully set-up service working", () => {
    const rows = statusRows(healthy, NOW);
    expect(rows.filter((r) => r.level === "attention")).toEqual([]);
    expect(rows.find((r) => /Backup/.test(r.label))!.text).toContain("9 hours ago");
  });

  it("flags every missing piece in plain words", () => {
    const rows = statusRows({ ...healthy, database: { ok: false, ms: null }, email: { configured: false, provider: null, from: "x" }, reminders: { configured: false, lastCheckAt: null }, clinicalContent: true, backup: { lastVerifiedRestoreAt: null, tables: null, rows: null, reporting: false } }, NOW);
    for (const label of [/Database/, /Email/, /Reminders/, /Backup/, /clinician/]) expect(level(rows, label)).toBe("attention");
    expect(rows.find((r) => /Email/.test(r.label))!.text).toContain("BREVO_API_KEY");
    expect(rows.find((r) => /Backup/.test(r.label))!.text).toContain("BACKUP_REPORT_TOKEN");
  });

  it("warns when the last verified restore is more than a day and a half old", () => {
    const stale = { ...healthy, backup: { ...healthy.backup, lastVerifiedRestoreAt: "2026-11-03T03:00:00Z" } };
    expect(level(statusRows(stale, NOW), /Backup/)).toBe("attention");
  });

  it("says a backup was never reported when reporting is on but nothing has arrived", () => {
    const none = { ...healthy, backup: { lastVerifiedRestoreAt: null, tables: null, rows: null, reporting: true } };
    expect(statusRows(none, NOW).find((r) => /Backup/.test(r.label))!.text).toContain("Run the");
  });
});
