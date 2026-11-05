import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { useToast } from "@/components/ui/Toast";
import { useFeatures } from "@/context/FeaturesContext";
import { disablePush, enablePush, needsHomeScreenForPush, pushIsOn, pushSupported } from "@/lib/push";
import { isNativeApp } from "@/lib/platform";
import { notificationState } from "@/lib/reminders";

/** Where she turns closed-app reminders on or off for this device, and reads what they can and can't do. */
export function RemindersTab() {
  const { pushPublicKey, loaded } = useFeatures();
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    let live = true;
    void pushIsOn().then((value) => live && setOn(value));
    return () => {
      live = false;
    };
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        if (await disablePush()) setOn(false);
        else toast.show("We couldn't turn that off just now. Please try again.");
      } else {
        const outcome = await enablePush(pushPublicKey);
        if (outcome === "on") setOn(true);
        else if (outcome === "denied") toast.show("Notifications are blocked for this site in your browser settings.");
        else toast.show("We couldn't turn that on just now. Please try again later.");
      }
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!loaded) {
    body = <p className="text-sm text-[var(--w360-text-muted)]">Loading…</p>;
  } else if (isNativeApp()) {
    body = (
      <p className="text-sm">
        In the Android app, reminders appear while Women360 is open. To be reminded when it's closed, use Women360 in your phone's browser and turn this on there.
      </p>
    );
  } else if (needsHomeScreenForPush()) {
    body = (
      <p className="text-sm">
        On iPhone and iPad, add Women360 to your Home Screen first (Share, then Add to Home Screen), open it from there, and come back to this page to turn reminders on. Apple only allows them for apps added this way.
      </p>
    );
  } else if (!supported) {
    body = <p className="text-sm">This browser can't receive reminders while Women360 is closed. They still appear inside Women360 while it's open.</p>;
  } else if (pushPublicKey === null) {
    body = <p className="text-sm">Reminders while Women360 is closed aren't switched on for this service yet. They still appear inside Women360 while it's open.</p>;
  } else {
    body = (
      <>
        <ToggleRow
          title="Reminders when Women360 is closed"
          description={busy ? "Setting this up. The first time can take up to a minute…" : "On this device only. Turn it on for each phone or computer you want reminders on."}
          checked={on === true}
          disabled={busy || on === null}
          onChange={toggle}
        />
        {notificationState() === "denied" && on !== true && (
          <p className="text-sm text-[var(--w360-text-muted)]">Notifications are blocked for this site in your browser settings, so this can't be turned on until you allow them there.</p>
        )}
      </>
    );
  }

  return (
    <Card>
      <CardBody className="pt-5 flex flex-col gap-4">
        {body}
        <div className="border-t border-[var(--w360-border)] pt-4 flex flex-col gap-2 text-sm text-[var(--w360-text-muted)]">
          <p>The notification is short and doesn't say what the reminder is for, because it can show on a locked screen. Tap it to see.</p>
          <p>Reminders arrive within a few minutes of the time you chose, and are skipped when the habit is already done or the dose already recorded. Medicine reminders are a convenience, not a safety system: don't rely on them alone.</p>
        </div>
      </CardBody>
    </Card>
  );
}
