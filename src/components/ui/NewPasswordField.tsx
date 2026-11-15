import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength, suggestPassword, type PasswordContext } from "@/lib/passwordPolicy";
import { playHide, playKey, playLevel, playReveal, playSparkle } from "@/lib/sound";
import { SoundToggle } from "./SoundToggle";
import { cn } from "@/lib/utils";
import "./NewPasswordField.css";

interface NewPasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Her name and email, so the field can warn before the server does. */
  context?: PasswordContext;
  /** A message from the server after submitting (the only time this field shows an error). */
  error?: string;
}

const AUTO_HIDE_MS = 30_000;

/**
 * Choosing a new password, calmly.
 * - The outline is the meter: it draws itself around the field as the password gets stronger. One quiet line says
 *   what's missing; no checklist, no red, no confirm field (show it instead).
 * - "Suggest one" fills in a strong, readable password that her browser or password manager can save.
 * - Characters are monospaced, so on "show" each dot turns into its letter in place.
 * - Privacy: while shown, the edges frost over like privacy glass, the little figure looks away, and the password hides
 *   itself again when she leaves the tab or after 30 seconds.
 * - Quiet sounds for typing, showing and suggesting (one switch turns them off).
 * The server still decides: 12+ characters, no common passwords, no runs, nothing from her name or email.
 */
export function NewPasswordField({ label, value, onChange, context, error }: NewPasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [lettersMounted, setLettersMounted] = useState(false);
  const [scroll, setScroll] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [focused, setFocused] = useState(false);
  const [announce, setAnnounce] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const previous = useRef({ length: value.length, level: 0 });
  const strength = passwordStrength(value, context);

  // Letters exist in the page only while shown (plus the moment they take to fold back into dots).
  useEffect(() => {
    if (visible) {
      setLettersMounted(true);
      return;
    }
    const t = setTimeout(() => setLettersMounted(false), 380);
    return () => clearTimeout(t);
  }, [visible]);

  // Hide again when she leaves the tab, or after a while.
  useEffect(() => {
    if (!visible) return;
    const hide = () => document.visibilityState === "hidden" && setVisible(false);
    const timer = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [visible, value]);

  // Sounds and announcements follow what changed.
  useEffect(() => {
    const prev = previous.current;
    if (value.length > prev.length) playKey();
    if (strength.level > prev.level && strength.level >= 2) {
      playLevel(strength.level);
      setAnnounce(strength.message);
    }
    if (strength.level < prev.level && strength.level === 1) setAnnounce(strength.message);
    previous.current = { length: value.length, level: strength.level };
  }, [value, strength.level, strength.message]);

  // The outline is drawn to the field's real size.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const syncScroll = () => setScroll(input.current?.scrollLeft ?? 0);

  function toggle() {
    setVisible((v) => {
      if (v) playHide();
      else playReveal();
      return !v;
    });
    input.current?.focus();
  }

  function suggest() {
    const next = suggestPassword(context);
    previous.current.length = next.length; // no typing click for a suggestion
    onChange(next);
    setVisible(true);
    playSparkle();
    setAnnounce("A strong password has been suggested and is shown. Your browser can save it.");
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.length, next.length);
      syncScroll();
    });
  }

  const meterClass = ["", "text-[var(--w360-text-muted)]", "text-[var(--w360-text)]", "text-[var(--w360-accent)]", "text-[var(--w360-accent)] npf-glow"][strength.level];
  const radius = 12;
  const perimeter = box.w && box.h ? 2 * (box.w + box.h - 4 * radius) + 2 * Math.PI * radius : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[var(--w360-text)] senior:text-lg">{label}</label>
        <div className="flex items-center gap-1">
          <SoundToggle />
          <LookAway away={visible} following={focused && !visible} progress={Math.min(1, value.length / 20)} />
        </div>
      </div>
      <div ref={frame} className={cn("npf relative rounded-xl bg-[var(--w360-bg-raised)]", visible && "npf-visible")}>
        {/* The meter: a track, and the outline drawn around it in proportion to strength. */}
        {perimeter > 0 && (
          <svg aria-hidden className={cn("absolute inset-0 pointer-events-none overflow-visible", meterClass)} width={box.w} height={box.h}>
            <rect x="0.75" y="0.75" width={box.w - 1.5} height={box.h - 1.5} rx={radius} fill="none" stroke="var(--w360-border)" strokeWidth="1.5" />
            <rect
              x="0.75"
              y="0.75"
              width={box.w - 1.5}
              height={box.h - 1.5}
              rx={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${strength.fraction * perimeter} ${perimeter}`}
              className="npf-meter"
            />
          </svg>
        )}
        <input
          ref={input}
          id={id}
          name="new-password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(syncScroll);
          }}
          onScroll={syncScroll}
          onKeyUp={syncScroll}
          onSelect={syncScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // Lets Safari's own suggestion follow our length rule.
          {...{ passwordrules: "minlength: 12;" }}
          aria-invalid={!!error}
          aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`}
          className="npf-input relative w-full bg-transparent rounded-xl pl-4 pr-24 py-3 text-base outline-none senior:text-lg senior:py-3.5"
        />
        {/* What she sees: a dot per character, each turning into its letter when shown. */}
        <div aria-hidden className="npf-glyphs absolute inset-y-0 left-4 right-24 overflow-hidden pointer-events-none flex items-center">
          <div className="whitespace-pre flex text-base senior:text-lg" style={{ transform: `translateX(${-scroll}px)` }}>
            {Array.from(value).map((ch, i) => (
              <span key={i} className="npf-cell" style={{ ["--i" as string]: Math.min(i, 24) }}>
                <span className="npf-dot" />
                {lettersMounted && <span className="npf-letter">{ch}</span>}
              </span>
            ))}
          </div>
        </div>
        {/* Privacy glass at the edges while the password is shown. */}
        <div aria-hidden className="npf-glass pointer-events-none absolute inset-0 rounded-xl" />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggle}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="p-2.5 rounded-lg text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p id={`${id}-status`} className="text-xs text-[var(--w360-text-muted)] senior:text-base">{strength.message}</p>
        <button type="button" onClick={suggest} className="shrink-0 text-xs font-medium text-[var(--w360-accent)] hover:underline underline-offset-2 senior:text-base">
          Suggest one
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-[var(--w360-danger-text)] senior:text-base">{error}</p>}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}

/** The figure who watches you type, and looks away while the password is shown. */
function LookAway({ away, following, progress }: { away: boolean; following: boolean; progress: number }) {
  const look = away ? 0 : following ? -2.2 + progress * 4.4 : 0;
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 40 40" className={cn("npf-face shrink-0", away && "npf-face-away")}>
      <circle cx="20" cy="21" r="14" fill="var(--w360-tint)" stroke="var(--w360-text)" strokeWidth="1.6" />
      <path d="M7 19 C8 9 16 5 22 6 C30 7 34 13 33.5 19 C30 14 25 12 20 12.5 C14 13 10 15.5 7 19 Z" fill="var(--w360-text)" />
      <g className="npf-eyes" style={{ transform: `translate(${look}px, ${following ? 1.2 : 0}px)` }}>
        <g className="npf-open">
          <circle cx="15" cy="22" r="1.9" fill="var(--w360-text)" />
          <circle cx="25" cy="22" r="1.9" fill="var(--w360-text)" />
        </g>
        <g className="npf-closed" fill="none" stroke="var(--w360-text)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12.5 22.5 Q15 24.5 17.5 22.5" />
          <path d="M22.5 22.5 Q25 24.5 27.5 22.5" />
        </g>
      </g>
      <path className="npf-mouth" d="M17 28 Q20 30 23 28" fill="none" stroke="var(--w360-text)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="27" r="1.6" fill="var(--w360-pop)" />
    </svg>
  );
}
