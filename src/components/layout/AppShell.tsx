import { Outlet, useLocation } from "react-router-dom";
import { menuTree } from "@/config/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useApp } from "@/context/AppContext";
import { useReminders } from "@/hooks/useReminders";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { SeniorTopBar } from "./SeniorNav";
import { Banner } from "@/components/ui/Banner";
import { TipsProvider } from "@/context/TipsContext";

const ROUTE_TITLES = menuTree.flatMap((n) => ("leaf" in n ? [n.leaf] : n.items));

export function AppShell() {
  return (
    <TipsProvider>
      <Shell />
    </TipsProvider>
  );
}

function Shell() {
  const { senior, auth } = useApp();
  useReminders();
  const demoNotice = auth.user?.isDemo ? (
    <Banner tone="info" title="Shared demonstration account" className="mb-5">
      The data here is synthetic. You can add, edit and delete records freely; the password, two-factor and account deletion are switched off for this account.
    </Banner>
  ) : null;
  const { pathname } = useLocation();
  usePageTitle(ROUTE_TITLES.find((r) => pathname === r.to || pathname.startsWith(`${r.to}/`))?.label);

  if (senior.seniorMode) {
    return (
      <div className="min-h-screen flex flex-col">
        <SeniorTopBar />
        <main className="flex-1 pb-8">
          {demoNotice && <div className="max-w-xl mx-auto px-5 pt-4">{demoNotice}</div>}
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-24 lg:pb-10 max-w-content w-full mx-auto">
          {demoNotice}
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
