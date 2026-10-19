import { Outlet, useLocation } from "react-router-dom";
import { menuTree } from "@/config/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { SeniorTopBar } from "./SeniorNav";

const ROUTE_TITLES = menuTree.flatMap((n) => ("leaf" in n ? [n.leaf] : n.items));

export function AppShell() {
  const { senior } = useApp();
  const { pathname } = useLocation();
  usePageTitle(ROUTE_TITLES.find((r) => pathname === r.to || pathname.startsWith(`${r.to}/`))?.label);

  if (senior.seniorMode) {
    return (
      <div className="min-h-screen flex flex-col">
        <SeniorTopBar />
        <main className="flex-1 pb-8">
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
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
