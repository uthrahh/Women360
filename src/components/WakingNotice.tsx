import { Banner } from "@/components/ui/Banner";
import { useApiWaking } from "@/hooks/useApiWaking";

/** Tells her why it is taking long, so a slow first sign-in doesn't look like a broken page. Renders nothing when requests are quick. */
export function WakingNotice({ className }: { className?: string }) {
  if (!useApiWaking()) return null;
  return (
    <Banner tone="info" title="Waking the service up" className={className}>
      Women360 was resting and is starting up. This can take up to 30 seconds the first time. Nothing is lost; please wait.
    </Banner>
  );
}
