import { useApp } from "@/context/AppContext";
import { Tabs } from "@/components/ui/Tabs";
import { OverviewTab } from "./OverviewTab";
import { UsersTab } from "./UsersTab";
import { AuditTab } from "./AuditTab";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { ContentTab } from "./ContentTab";

/** The administrator's working page: accounts and roles, the audit log, feedback and the Learn content. */
export default function AdminPage() {
  const { auth } = useApp();
  const user = auth.user!;
  const readOnly = !!user.isDemo;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Administration</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Accounts, roles, content and the record of sensitive actions.</p>
      </div>
      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab /> },
          { id: "users", label: "Users", content: <UsersTab readOnly={readOnly} selfId={user.id} /> },
          { id: "audit", label: "Audit log", content: <AuditTab /> },
          { id: "feedback", label: "Feedback", content: <AdminFeedbackTab /> },
          { id: "content", label: "Learn content", content: <ContentTab readOnly={readOnly} /> },
        ]}
      />
    </div>
  );
}
