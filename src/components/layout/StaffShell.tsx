import { Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";

const LABEL = { admin: "Administrator", coach: "Wellness coach", woman: "" } as const;

/**
 * The frame for the administrator and coach areas. They do not use the woman's
 * sidebar, tiles or Senior Mode: they get a plain header and one working page.
 */
export function StaffShell() {
  const { auth } = useApp();
  const nav = useNavigate();
  const user = auth.user!;
  usePageTitle(LABEL[user.role]);

  return (
    <div className="min-h-screen bg-[var(--w360-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--w360-border)] bg-[var(--w360-bg)]/95 backdrop-blur">
        <div className="max-w-content mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-xl font-semibold">Women360</span>
            <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-[var(--w360-tint)] text-[var(--w360-tint-text)]">{LABEL[user.role]}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden sm:block text-sm text-[var(--w360-text-muted)] truncate max-w-[16rem]">{user.name}</span>
            <ThemeToggle />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                auth.logout();
                nav("/login");
              }}
            >
              <LogOut size={15} /> Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-content mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {user.isDemo && (
          <Banner tone="info" title="Shared demonstration account">
            {user.role === "admin"
              ? "You can look around everything the administrator can see, but this account is read-only and only shows demonstration accounts."
              : "This is a shared demonstration account with synthetic data."}
          </Banner>
        )}
        <Outlet />
      </main>
    </div>
  );
}
