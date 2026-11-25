import { Tabs } from "@/components/ui/Tabs";
import { ProgrammeCaseload } from "./ProgrammeCaseload";
import { SharedWithYou } from "./SharedWithYou";
import { ClientsTab } from "./clients/ClientsTab";

/**
 * The coach's working page. Three relationships, kept apart: clients the coach looks after (their record, cut to her specialities),
 * people in a guided programme an administrator assigned (their answers and task reports only), and women who shared their own logs.
 */
export default function CoachPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Your clients</h1>
      <Tabs
        urlParam="tab"
        tabs={[
          { id: "clients", label: "Clients", content: <ClientsTab /> },
          { id: "programme", label: "Programme", content: <ProgrammeCaseload /> },
          { id: "shared", label: "Shared with you", content: <SharedWithYou /> },
        ]}
      />
    </div>
  );
}
