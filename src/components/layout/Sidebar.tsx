import { Link } from "react-router-dom";
import { AppMenu } from "./AppMenu";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--w360-border)] h-screen sticky top-0 py-6">
      <div className="px-6 mb-6">
        <Link to="/app/dashboard" className="font-display text-xl font-semibold tracking-tight">Women360</Link>
      </div>
      <div className="flex-1 overflow-y-auto w360-scrollbar px-5" aria-label="Primary">
        <AppMenu />
      </div>
    </aside>
  );
}
