import { useEffect, useRef, useState } from "react";
import { activityService } from "@/services/activityService";
import { localDateISO } from "@/services/mappers";
import { askDevicePermission, deviceAllowed, deviceStatus, readDeviceSteps, type DeviceStatus } from "@/lib/healthSync";
import { MAX_SYNC_DAYS, parseStepsCsv, readAppleHealthExport, syncWindow, type DaySteps } from "@/lib/stepsImport";
import { Hint } from "@/components/ui/Hint";
import { useToast } from "@/components/ui/Toast";

const linkClass = "text-xs font-medium text-maroon-700 dark:text-maroon-200 disabled:opacity-60";
const MAX_FILE_BYTES = 600 * 1024 * 1024; // an Apple Health export can be hundreds of MB; it is read in pieces, never whole

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Fills in her step totals from her phone (Health Connect, in the Android app) or from a file she exports.
 * Collapsed to one line: nothing here asks her to do anything until she chooses to. Days she typed herself are never overwritten.
 */
export function StepsSync({ onChanged }: { onChanged: () => Promise<unknown> | void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ lastSyncedAt: string | null; source: "DEVICE" | "IMPORT" | null } | null>(null);

  const refreshStatus = () => activityService.syncStatus().then(setLast).catch(() => undefined);

  async function send(source: "DEVICE" | "IMPORT", days: DaySteps[], quiet = false) {
    if (days.length === 0) {
      if (!quiet) toast.show("There were no step counts for the last few weeks.", { tone: "error" });
      return;
    }
    const res = await activityService.syncSteps(source, days.slice(-MAX_SYNC_DAYS));
    await onChanged();
    await refreshStatus();
    if (!quiet) {
      const kept = res.keptOwn > 0 ? ` Kept ${res.keptOwn} ${res.keptOwn === 1 ? "day" : "days"} you entered yourself.` : "";
      toast.show(`Steps filled in for ${res.saved} ${res.saved === 1 ? "day" : "days"}.${kept}`);
    }
  }

  async function syncDevice(quiet: boolean) {
    setBusy(true);
    try {
      await send("DEVICE", await readDeviceSteps(localDateISO()), quiet);
    } catch {
      if (!quiet) toast.show("Couldn't read steps from Health Connect. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let live = true;
    refreshStatus();
    deviceStatus().then(async (s) => {
      if (!live) return;
      setDevice(s);
      if (s === "ready" && (await deviceAllowed())) {
        if (!live) return;
        setAllowed(true);
        void syncDevice(true); // she already said yes once: keep her steps current without asking again
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    try {
      if (!(await askDevicePermission())) {
        toast.show("Steps weren't allowed. You can allow them in Health Connect whenever you like.", { tone: "error" });
        return;
      }
      setAllowed(true);
      await send("DEVICE", await readDeviceSteps(localDateISO()));
    } catch {
      toast.show("Couldn't connect to Health Connect. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("That file is too large to read here.");
      const range = syncWindow(localDateISO(), 30);
      const name = file.name.toLowerCase();
      let days: DaySteps[];
      if (name.endsWith(".xml")) days = await readAppleHealthExport(file, range);
      else if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const { days: parsed, skipped } = parseStepsCsv(await file.text(), range);
        if (parsed.length === 0 && skipped > 0) throw new Error("Couldn't read that file. Each line should be a date and a step count, like 2026-11-18,6500.");
        days = parsed;
      } else {
        throw new Error("Choose export.xml from Apple Health (unzip the export first), or a .csv file.");
      }
      await send("IMPORT", days);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't read that file.", { tone: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const fromPhone = device === "ready";
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {fromPhone && !allowed && (
          <button type="button" className={linkClass} onClick={connect} disabled={busy}>
            Fill in from my phone
          </button>
        )}
        {fromPhone && allowed && (
          <button type="button" className={linkClass} onClick={() => syncDevice(false)} disabled={busy}>
            {busy ? "Syncing..." : "Sync now"}
          </button>
        )}
        <button type="button" className={linkClass} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy && !fromPhone ? "Reading file..." : "Import from a file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xml,.csv,.txt,text/csv,text/xml"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a step file to import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      </div>
      {device === "needs-health-connect" && (
        <p className="text-xs text-[var(--w360-text-muted)]">Install or update Health Connect on this phone to fill in steps from it.</p>
      )}
      {last?.lastSyncedAt && (
        <p className="text-xs text-[var(--w360-text-muted)]">Last filled in from {last.source === "DEVICE" ? "your phone" : "a file"}: {when(last.lastSyncedAt)}</p>
      )}
      <Hint id="act-steps-import" className="text-xs text-[var(--w360-text-muted)]">
        {fromPhone
          ? "Reads only your daily step totals from Health Connect. Days you entered yourself are never changed."
          : "Use export.xml from the Apple Health app (unzip the export), or a .csv with a date and a step count on each line. Only daily totals are kept, and days you entered yourself are never changed."}
      </Hint>
    </div>
  );
}
