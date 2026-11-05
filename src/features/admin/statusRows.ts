import type { SystemStatus } from "@/types";

export type Level = "ok" | "attention" | "info";

function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export interface Row { label: string; level: Level; text: string }

/** Turns the server's report into plain sentences, each marked with a word as well as a colour. */
export function statusRows(s: SystemStatus, now = Date.now()): Row[] {
  const rows: Row[] = [];
  rows.push({
    label: "Database",
    level: s.database.ok ? "ok" : "attention",
    text: s.database.ok ? `Answering (${s.database.ms} ms).` : "Not answering. People cannot sign in. Check the Supabase project (it may be paused).",
  });
  rows.push({
    label: "Email (password reset, alerts to you)",
    level: s.email.configured ? "ok" : "attention",
    text: s.email.configured
      ? `Sending through ${s.email.provider === "brevo" ? "Brevo" : "SMTP"} as ${s.email.from}.`
      : "Not set up. A forgotten password cannot be recovered and you will not get alert emails. Add BREVO_API_KEY on Render.",
  });
  rows.push({
    label: "Reminders when the app is closed",
    level: s.reminders.configured ? "ok" : "attention",
    text: s.reminders.configured
      ? s.reminders.lastCheckAt
        ? `On. Last checked ${ago(s.reminders.lastCheckAt, now)}.`
        : "On. The first check runs within a minute of the server starting."
      : "Off. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on Render (npm --prefix server run push:keys).",
  });
  const b = s.backup;
  let backup: Row;
  if (b.lastVerifiedRestoreAt) {
    const hours = (now - new Date(b.lastVerifiedRestoreAt).getTime()) / 3_600_000;
    backup = {
      label: "Backup, proven to restore",
      level: hours > 36 ? "attention" : "ok",
      text: `Last verified restore ${ago(b.lastVerifiedRestoreAt, now)}: ${b.tables} tables, ${b.rows?.toLocaleString()} rows.${hours > 36 ? " That is more than a day and a half ago: check the nightly run in GitHub Actions." : ""}`,
    };
  } else if (b.reporting) {
    backup = { label: "Backup, proven to restore", level: "attention", text: "Nothing reported yet. Run the 'Database backup and restore test' workflow in GitHub Actions once." };
  } else {
    backup = { label: "Backup, proven to restore", level: "attention", text: "Not reporting here. Add BACKUP_REPORT_TOKEN on Render and as a GitHub secret (docs/OPERATIONS.md, section 3). The nightly job can still run without it." };
  }
  rows.push(backup);
  rows.push({
    label: "Features awaiting a clinician",
    level: s.clinicalContent ? "attention" : "ok",
    text: s.clinicalContent ? "ON. Only leave this on once a clinician has reviewed the health content." : "Off, as intended until a clinician has reviewed them.",
  });
  rows.push({ label: "Server started", level: "info", text: `${ago(s.startedAt, now)}. A recent start means the server had been asleep or was just updated (${s.environment}).` });
  return rows;
}

