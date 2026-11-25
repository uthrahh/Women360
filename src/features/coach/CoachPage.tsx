import { Tabs } from "@/components/ui/Tabs";
import { ProgrammeCaseload } from "./ProgrammeCaseload";
import { SharedWithYou } from "./SharedWithYou";

/**
 * The coach's working page. Two different relationships, kept apart: people in a guided programme an administrator assigned to this
 * coach (their answers and task reports only), and women who chose to share their own logs.
 */
export default function CoachPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold">Your clients</h1>
      <Tabs
        urlParam="tab"
        tabs={[
          { id: "programme", label: "Programme", content: <ProgrammeCaseload /> },
          { id: "shared", label: "Shared with you", content: <SharedWithYou /> },
        ]}
      />
    </div>
  );
}
