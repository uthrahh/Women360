import { Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { SeniorTopBar } from "./SeniorNav";

export function AppShell() {
  const { senior } = useApp();

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
