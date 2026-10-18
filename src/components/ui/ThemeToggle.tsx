import { Moon, Sun } from "lucide-react";
import { useApp } from "@/context/AppContext";

// Light/dark switch for pages outside the signed-in shell (landing, sign-in),
// where the top bar's toggle isn't available.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme } = useApp();
  const dark = theme.theme === "dark";
  return (
    <button
      type="button"
      onClick={theme.toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`p-2 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${className}`}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
