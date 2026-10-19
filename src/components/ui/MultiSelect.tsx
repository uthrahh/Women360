import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import clsx from "clsx";

/** The exclusive "nothing applies" choice: picking it clears the rest, and picking anything else clears it. */
export const NONE = "None";

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  hint?: string;
  placeholder?: string;
  /** Lets the person add something that isn't in the list. */
  allowCustom?: boolean;
  customPlaceholder?: string;
}

/**
 * A dropdown where several things can be ticked. "None" is always the first
 * choice and is exclusive. The list opens in the flow of the page (it pushes
 * content down rather than floating over it), so it can't be clipped by a
 * scrolling or overflow-hidden parent such as a stepper step.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  hint,
  placeholder = "Select all that apply",
  allowCustom = true,
  customPlaceholder = "Something else",
}: MultiSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [custom, setCustom] = useState("");

  const all = [NONE, ...options, ...value.filter((v) => v !== NONE && !options.includes(v))];
  const none = value.includes(NONE);

  useEffect(() => {
    if (!open) return;
    function onPress(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function toggle(option: string) {
    if (option === NONE) {
      onChange(none ? [] : [NONE]);
      return;
    }
    const without = value.filter((v) => v !== NONE);
    onChange(without.includes(option) ? without.filter((v) => v !== option) : [...without, option]);
  }

  function addCustom() {
    const text = custom.trim().slice(0, 80);
    if (!text) return;
    if (!value.some((v) => v.toLowerCase() === text.toLowerCase())) {
      onChange([...value.filter((v) => v !== NONE), text]);
    }
    setCustom("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLInputElement) return; // typing in the "something else" box
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(all.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(all.length - 1);
    } else if (e.key === " " || e.key === "Enter") {
      if (e.target instanceof HTMLButtonElement && e.target.dataset.role !== "trigger") return;
      e.preventDefault();
      toggle(all[active]);
    }
  }

  const summary = value.length === 0 ? placeholder : none ? NONE : value.join(", ");

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-[var(--w360-text)]">{label}</span>
      <button
        type="button"
        data-role="trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label`}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-[var(--w360-bg-raised)] text-sm text-left",
          "senior:text-lg senior:py-3.5 senior:rounded-2xl",
          open ? "border-[var(--w360-focus)]" : "border-[var(--w360-border)]"
        )}
      >
        <span className={clsx("truncate", value.length === 0 && "text-[var(--w360-text-muted)]")}>{summary}</span>
        <ChevronDown size={16} aria-hidden className={clsx("shrink-0 text-[var(--w360-text-muted)] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] overflow-hidden">
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${id}-label`}
            className="max-h-60 overflow-y-auto w360-scrollbar py-1"
          >
            {all.map((option, i) => {
              const checked = value.includes(option);
              return (
                <li
                  key={option}
                  data-i={i}
                  role="option"
                  aria-selected={checked}
                  onClick={() => {
                    setActive(i);
                    toggle(option);
                  }}
                  onMouseMove={() => active !== i && setActive(i)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer senior:text-lg",
                    i === active && "bg-[var(--w360-tint)]",
                    option === NONE && "border-b border-[var(--w360-border)] mb-1 pb-3"
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      "w-[18px] h-[18px] shrink-0 rounded-[5px] border flex items-center justify-center",
                      checked ? "bg-maroon-700 border-maroon-700 text-white dark:bg-maroon-300 dark:border-maroon-300 dark:text-ink-900" : "border-[var(--w360-border)]"
                    )}
                  >
                    {checked && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className={clsx(option === NONE && "font-medium")}>{option}</span>
                </li>
              );
            })}
          </ul>
          {allowCustom && (
            <div className="flex items-center gap-2 p-2 border-t border-[var(--w360-border)]">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                maxLength={80}
                placeholder={customPlaceholder}
                aria-label={`${label}: add something not listed`}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg)] text-sm placeholder:text-[var(--w360-text-muted)]"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!custom.trim()}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--w360-border)] hover:border-maroon-400 disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}
        </div>
      )}

      {value.length > 0 && !none && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: selected`}>
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs bg-[var(--w360-tint)] text-[var(--w360-tint-text)]">
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Remove ${v}`}
                className="p-0.5 rounded-full hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="text-xs text-[var(--w360-text-muted)]">{hint}</p>}
    </div>
  );
}
