import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { usePresence } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";

export interface ComboItem {
  value: string;
  label: string;
  /** Items with the same group are listed under that heading. */
  group?: string;
}

interface ComboBoxProps {
  label: string;
  items: ComboItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A list you can search: type to narrow it, arrows to move, Enter to choose, Escape to close. For lists too long to scan
 * (a plain select is better for a handful). Follows the ARIA combobox pattern (one input, a listbox, the highlighted
 * option announced through aria-activedescendant). The list grows from the field's top edge and leaves a little quicker.
 */
export function ComboBox({ label, items, value, onChange, placeholder = "Search", id }: ComboBoxProps) {
  const auto = useId();
  const base = id ?? auto;
  const selected = items.find((i) => i.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const popup = usePresence(open);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)) : items;
  }, [items, query]);

  useEffect(() => setActive(0), [query, open]);
  // Keep the highlighted option in view as the arrows move.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: ComboItem) {
    onChange(item.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // choosing, not submitting the form
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // closes the list, not the dialog around it
      setQuery("");
      setOpen(false);
    }
  }

  let lastGroup: string | undefined;
  return (
    <div className="flex flex-col gap-1.5 relative">
      <label htmlFor={`${base}-input`} className="text-sm font-medium senior:text-lg">{label}</label>
      <div className="relative">
        <input
          ref={input}
          id={`${base}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${base}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${base}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={open ? query : selected?.label ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={onKeyDown}
          className="w-full pl-3.5 pr-10 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
        />
        <ChevronDown aria-hidden size={16} className={cn("absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--w360-text-muted)] transition-transform duration-popover ease-move", open && "rotate-180")} />
      </div>
      {popup.mounted && (
        <ul
          ref={list}
          id={`${base}-list`}
          role="listbox"
          aria-label={label}
          data-state={popup.state}
          style={{ ["--origin" as string]: "top" }}
          className="w360-pop absolute left-0 right-0 top-full mt-1.5 z-30 max-h-60 overflow-y-auto w360-scrollbar rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] shadow-card py-1"
        >
          {shown.length === 0 && <li role="presentation" className="px-3.5 py-2.5 text-sm text-[var(--w360-text-muted)]">Nothing matches "{query}"</li>}
          {shown.map((item, i) => {
            const heading = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.value} role="presentation">
                {heading && <p role="presentation" className="px-3.5 pt-2 pb-1 text-xs font-medium text-[var(--w360-text-muted)]">{heading}</p>}
                <div
                  id={`${base}-opt-${i}`}
                  role="option"
                  data-index={i}
                  aria-selected={item.value === value}
                  // mousedown (not click) so the input keeps focus and doesn't close the list before the choice lands
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(item);
                  }}
                  onMouseMove={() => setActive(i)}
                  className={cn("px-3.5 py-2.5 text-sm senior:text-lg cursor-pointer", i === active && "bg-[var(--w360-tint)]", item.value === value && "font-medium")}
                >
                  {item.label}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
