import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { LogOut, Moon, Sun, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Kbd } from "@/components/ui/Kbd";
import { menuTree } from "@/config/navigation";
import { useApp } from "@/context/AppContext";
import { useFeatures } from "@/context/FeaturesContext";
import { GO_KEYS, GO_WINDOW_MS, OPEN_COMMAND_MENU_EVENT, destinationFor, isTypingTarget, matchesQuery, modKeyLabel } from "@/lib/shortcuts";

interface Command {
  id: string;
  label: string;
  group: "Go to" | "Do";
  keywords?: string;
  icon: ReactNode;
  /** Keys to show as a hint, such as ["G", "H"]. */
  hint?: string[];
  run: () => void;
}

/**
 * A quick way to go anywhere or do the common things without hunting through menus: Ctrl+K (or ?) opens it, type a few
 * letters, Enter. The same list shows the keyboard shortcut for each thing, which is how the shortcuts get discovered.
 * Also installs the global shortcuts: G then a letter jumps to a screen.
 */
export function CommandMenu() {
  const nav = useTransitionNavigate();
  const { theme, senior, auth } = useApp();
  const { clinicalContent } = useFeatures();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const screens = menuTree.flatMap((node) => ("leaf" in node ? [node.leaf] : node.items)).filter((i) => clinicalContent || i.to !== "/app/learn");
    const go: Command[] = screens.map((s) => ({
      id: s.to,
      label: s.label,
      group: "Go to",
      icon: <s.icon size={16} strokeWidth={1.75} />,
      hint: GO_KEYS[s.to] ? ["G", GO_KEYS[s.to] === "," ? "," : GO_KEYS[s.to].toUpperCase()] : undefined,
      run: () => nav(s.to),
    }));
    return [
      ...go,
      {
        id: "theme",
        label: theme.theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        group: "Do",
        keywords: "theme appearance dark light night",
        icon: theme.theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />,
        run: theme.toggle,
      },
      {
        id: "senior",
        label: senior.seniorMode ? "Turn Senior Mode off" : "Turn Senior Mode on",
        group: "Do",
        keywords: "larger text simple accessibility",
        icon: <Users size={16} strokeWidth={1.75} />,
        run: senior.toggleSeniorMode,
      },
      {
        id: "logout",
        label: "Log out",
        group: "Do",
        keywords: "sign out",
        icon: <LogOut size={16} strokeWidth={1.75} />,
        run: () => {
          auth.logout();
          nav("/login");
        },
      },
    ];
  }, [clinicalContent, nav, theme, senior, auth]);

  const shown = useMemo(() => commands.filter((c) => matchesQuery(query, c.label, c.keywords ?? "", c.group)), [commands, query]);

  // Opening: Ctrl/Command+K, "?", or the button in the top bar. "G then a letter" goes straight to a screen.
  useEffect(() => {
    let goUntil = 0;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (Date.now() < goUntil) {
        goUntil = 0;
        const to = destinationFor(e.key);
        if (to && !(to === "/app/learn" && !clinicalContent)) {
          e.preventDefault();
          nav(to);
        }
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.shiftKey) goUntil = Date.now() + GO_WINDOW_MS;
    }
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
    };
  }, [nav, clinicalContent]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => setActive(0), [query]);

  function choose(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    // Let the dialog hand focus back before the command moves her somewhere else.
    setTimeout(command.run, 0);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    }
  }

  // Keep the highlighted row in view as the arrow keys move it.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const groups = (["Go to", "Do"] as const).map((g) => ({ name: g, items: shown.filter((c) => c.group === g) })).filter((g) => g.items.length > 0);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Quick jump" size="sm">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={shown.length > 0 ? `${listId}-${active}` : undefined}
        aria-label="Type to find a screen or an action"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onInputKey}
        placeholder="Go to…"
        className="w-full rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg)] px-3 py-2.5 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
      />
      <div id={listId} role="listbox" aria-label="Results" className="mt-3 max-h-72 overflow-y-auto -mx-1 px-1">
        {shown.length === 0 && <p className="px-2 py-6 text-sm text-center text-[var(--w360-text-muted)]">Nothing matches &ldquo;{query}&rdquo;.</p>}
        {groups.map((group) => (
          <div key={group.name} role="presentation">
            <p role="presentation" className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--w360-text-muted)]">{group.name}</p>
            {group.items.map((c) => {
              const index = shown.indexOf(c);
              return (
                <div
                  key={c.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(c)}
                  className={`flex items-center gap-3 rounded-md px-2 py-2.5 cursor-pointer text-sm ${index === active ? "bg-[var(--w360-tint)] text-[var(--w360-tint-text)]" : ""}`}
                >
                  <span aria-hidden className="shrink-0 text-[var(--w360-text-muted)]">{c.icon}</span>
                  <span className="flex-1">{c.label}</span>
                  {c.hint && (
                    <span className="flex items-center gap-1 text-xs text-[var(--w360-text-muted)]" aria-label={`Shortcut: ${c.hint.join(" then ")}`}>
                      {c.hint.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 pt-3 border-t border-[var(--w360-border)] text-xs text-[var(--w360-text-muted)] flex flex-wrap gap-x-4 gap-y-1">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span>
        <span><Kbd>Enter</Kbd> open</span>
        <span><Kbd>Esc</Kbd> close</span>
        <span>Open this any time: <Kbd>{modKeyLabel()}</Kbd> <Kbd>K</Kbd> or <Kbd>?</Kbd></span>
      </p>
    </Modal>
  );
}
