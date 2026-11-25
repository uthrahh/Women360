import { Fragment } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FAMILY_SCREENS, menuTree } from "@/config/navigation";
import { FamilyProvider, useFamily } from "@/context/FamilyContext";
import { Button } from "@/components/ui/Button";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useApp } from "@/context/AppContext";
import { useReminders } from "@/hooks/useReminders";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { SeniorTopBar } from "./SeniorNav";
import { Banner } from "@/components/ui/Banner";
import { WakingNotice } from "@/components/WakingNotice";
import { VerifyEmailNotice } from "@/components/VerifyEmailNotice";
import { CommandMenu } from "@/components/CommandMenu";
import { TipsProvider } from "@/context/TipsContext";

const ROUTE_TITLES = menuTree.flatMap((n) => ("leaf" in n ? [n.leaf] : n.items));

export function AppShell() {
  return (
    <TipsProvider>
      <FamilyProvider>
        <Shell />
      </FamilyProvider>
    </TipsProvider>
  );
}

function Shell() {
  const { senior, auth } = useApp();
  useReminders();
  useUsageTracking();
  const commandMenu = <CommandMenu />;
  const demoNotice = auth.user?.isDemo ? (
    <Banner tone="info" title="Shared demonstration account" className="mb-5">
      The data here is synthetic. You can add, edit and delete records freely; the password, two-factor and account deletion are switched off for this account.
    </Banner>
  ) : null;
  const { pathname } = useLocation();
  usePageTitle(ROUTE_TITLES.find((r) => pathname === r.to || pathname.startsWith(`${r.to}/`))?.label);
  const { acting } = useFamily();
  // Each person's screens are mounted fresh, so nothing loaded for one person is ever shown as another's.
  const page = <Fragment key={acting?.id ?? "me"}>{acting && !FAMILY_SCREENS.some((s) => pathname === s || pathname.startsWith(`${s}/`)) ? <NotWhileActing /> : <Outlet />}</Fragment>;
  const actingBanner = acting ? <ActingBanner /> : null;

  if (senior.seniorMode) {
    return (
      <div className="min-h-screen flex flex-col">
        {commandMenu}
        <SeniorTopBar />
        <main className="flex-1 pb-8">
          <div className="max-w-xl mx-auto px-5 pt-4 empty:hidden"><WakingNotice /></div>
          {demoNotice && <div className="max-w-xl mx-auto px-5 pt-4">{demoNotice}</div>}
          <div className="max-w-xl mx-auto px-5 pt-4 empty:hidden"><VerifyEmailNotice /></div>
          {actingBanner && <div className="max-w-xl mx-auto px-5 pt-4">{actingBanner}</div>}
          {page}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {commandMenu}
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-[calc(6rem+var(--safe-bottom))] lg:pb-10 max-w-content w-full mx-auto">
          <WakingNotice className="mb-5" />
          {demoNotice}
          <VerifyEmailNotice className="mb-5" />
          {actingBanner}
          {page}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

const ACCESS_TEXT = { MANAGE: "You keep this profile", MODIFY: "You can view and update", MONITOR: "View only" } as const;

/** Always on screen while she looks at someone else's records, so she never mistakes them for her own. */
function ActingBanner() {
  const { acting, backToMe } = useFamily();
  const nav = useTransitionNavigate();
  if (!acting) return null;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-maroon-600 dark:border-maroon-300 px-4 py-3">
      <p className="text-sm min-w-0">
        <span className="font-semibold">{acting.name}'s records</span>
        <span className="text-[var(--w360-text-muted)]"> · {ACCESS_TEXT[acting.access]}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          backToMe();
          nav("/app/family");
        }}
      >
        Back to my records
      </Button>
    </div>
  );
}

function NotWhileActing() {
  const { acting, backToMe } = useFamily();
  return (
    <div className="py-10 flex flex-col items-start gap-3">
      <h1 className="font-display text-2xl font-semibold">This screen is for your own account</h1>
      <p className="text-sm text-[var(--w360-text-muted)] measure">You're looking at {acting?.name}'s records. Go back to your own records to open it.</p>
      <Button onClick={backToMe}>Back to my records</Button>
    </div>
  );
}
