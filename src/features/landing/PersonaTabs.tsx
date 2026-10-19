import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";

// Life-stage tabs for the landing page. Each tab pairs a short, honest
// description of what Women360 does at that stage with a small looping
// illustration. The illustrations are abstract on purpose: they show how a
// feature behaves, never sample data or numbers.

const ACCENT = "var(--w360-accent)";
const SOFT = (pct: number) => `color-mix(in srgb, var(--w360-accent) ${pct}%, var(--w360-tint))`;

function wavePath(amp: number, period: number, y: number, periods: number): string {
  let d = `M0,${y} Q${period / 4},${y - amp} ${period / 2},${y}`;
  for (let i = 1; i < periods * 2; i++) d += ` T${(period / 2) * (i + 1)},${y}`;
  return d;
}

function CycleArt() {
  const arcs = [100, 70, 45, 25];
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" role="img" aria-label="A ring divided into the four phases of a cycle, with a marker slowly travelling around it">
      <g transform="rotate(-90 160 120)" fill="none" strokeWidth="22">
        {arcs.map((pct, i) => (
          <circle key={i} cx="160" cy="120" r="78" pathLength="100" strokeDasharray="23 77" strokeDashoffset={-25 * i} stroke={pct === 100 ? ACCENT : SOFT(pct)} />
        ))}
      </g>
      <g className="w360-orbit" style={{ transformOrigin: "160px 120px" }}>
        <circle cx="160" cy="42" r="9" fill="var(--w360-bg-raised)" stroke="var(--w360-accent-strong)" strokeWidth="3.5" />
      </g>
      <text x="160" y="126" textAnchor="middle" fontSize="17" fontWeight="600" fill="var(--w360-text)" style={{ fontFamily: "Fraunces, serif" }}>Your cycle</text>
    </svg>
  );
}

function WaveArt() {
  const lines = [
    { y: 70, amp: 22, time: "9s", color: ACCENT },
    { y: 120, amp: 16, time: "14s", color: SOFT(60) },
    { y: 170, amp: 26, time: "19s", color: SOFT(35) },
  ];
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" role="img" aria-label="Three gently moving waves, standing for sleep, stress and energy">
      <defs>
        <clipPath id="w360-wave-clip"><rect x="20" y="30" width="280" height="180" rx="16" /></clipPath>
      </defs>
      <g clipPath="url(#w360-wave-clip)">
        {lines.map((l) => (
          <g key={l.y} className="w360-drift" style={{ ["--w360-drift-time" as string]: l.time }}>
            <path d={wavePath(l.amp, 120, l.y, 5)} fill="none" stroke={l.color} strokeWidth="5" strokeLinecap="round" transform="translate(20 0)" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function StrengthArt() {
  const bars = [92, 132, 74, 150, 112];
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" role="img" aria-label="Five bars of different heights rising from a baseline">
      <line x1="30" y1="196" x2="290" y2="196" stroke="var(--w360-border)" strokeWidth="2" />
      {bars.map((h, i) => (
        <rect key={i} className="w360-grow" style={{ animationDelay: `${i * 110}ms` }} x={46 + i * 50} y={196 - h} width="34" height={h} rx="10" fill={i === 3 ? ACCENT : SOFT(55 - i * 6)} />
      ))}
    </svg>
  );
}

function SimpleArt() {
  const tiles = ["How I'm doing", "My medicines", "My appointments"];
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" role="img" aria-label="Three large, plainly labelled tiles with a highlight moving between them">
      {tiles.map((t, i) => (
        <g key={t}>
          <rect x="40" y={34 + i * 58} width="240" height="46" rx="14" fill="var(--w360-bg-raised)" stroke="var(--w360-border)" strokeWidth="2" />
          <text x="60" y={63 + i * 58} fontSize="15" fontWeight="600" fill="var(--w360-text)">{t}</text>
        </g>
      ))}
      <rect className="w360-select" x="36" y="30" width="248" height="54" rx="17" fill="none" stroke={ACCENT} strokeWidth="3" />
    </svg>
  );
}

interface Persona {
  id: string;
  label: string;
  kicker: string;
  title: string;
  body: string;
  lines: string[];
  art: ReactNode;
  caption: string;
}

const PERSONAS: Persona[] = [
  {
    id: "18-30",
    label: "18–30",
    kicker: "Cycle awareness",
    title: "Learn your own cycle.",
    body: "Log the day your period starts in one tap. Women360 predicts a range from your own cycles, never a single date, and tells you how sure it is.",
    lines: ["A range, not a promise", "Phases shown on a calendar", "Not a birth control method"],
    art: <CycleArt />,
    caption: "Menstrual · Follicular · Ovulation · Luteal",
  },
  {
    id: "30-45",
    label: "30–45",
    kicker: "Life under load",
    title: "See what's behind the tired weeks.",
    body: "Sleep, stress, movement and food sit side by side, so patterns you'd miss day to day start to show. Observations come from your own logs, not averages.",
    lines: ["Sleep, mood and food together", "Habits that take a tap", "Insights from your data alone"],
    art: <WaveArt />,
    caption: "Sleep · Stress · Energy",
  },
  {
    id: "45-60",
    label: "45–60",
    kicker: "Changing hormones",
    title: "Stay ahead of the changes.",
    body: "Track cycles and symptoms through perimenopause, where predictions are honest about being less certain, and build strength and mobility into your week.",
    lines: ["Cycle tracking that admits uncertainty", "Goals for strength and mobility", "Appointments in one place"],
    art: <StrengthArt />,
    caption: "Strength · Mobility · Balance · Sleep · Recovery",
  },
  {
    id: "60-plus",
    label: "60+",
    kicker: "Simple by design",
    title: "Fewer taps, nothing hidden.",
    body: "Senior Mode turns Women360 into a handful of large, clearly labelled tiles that you choose, instead of a full dashboard.",
    lines: ["Large, plain-language tiles", "Medicines and appointments up front", "You choose what appears"],
    art: <SimpleArt />,
    caption: "Senior Mode",
  },
];

export function PersonaTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(to: number) {
    const next = (to + PERSONAS.length) % PERSONAS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") move(active + 1);
    else if (e.key === "ArrowLeft") move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(PERSONAS.length - 1);
    else return;
    e.preventDefault();
  }

  const p = PERSONAS[active];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Life stages"
        onKeyDown={onKeyDown}
        className="inline-flex max-w-full gap-1 p-1 rounded-full bg-warmgrey-100 dark:bg-white/[0.07] overflow-x-auto w360-hide-scrollbar"
      >
        {PERSONAS.map((persona, i) => (
          <button
            key={persona.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`persona-tab-${persona.id}`}
            aria-selected={i === active}
            aria-controls={`persona-panel-${persona.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={clsx(
              "px-5 py-2 text-sm font-medium whitespace-nowrap rounded-full transition-colors",
              i === active
                ? "bg-[var(--w360-bg-raised)] text-maroon-800 dark:text-maroon-200 shadow-subtle"
                : "text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
            )}
          >
            {persona.label}
          </button>
        ))}
      </div>

      <div
        key={p.id}
        role="tabpanel"
        id={`persona-panel-${p.id}`}
        aria-labelledby={`persona-tab-${p.id}`}
        className="w360-panel-in mt-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-14 items-center"
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-maroon-700 dark:text-maroon-300 mb-3">{p.kicker}</p>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold leading-tight">{p.title}</h3>
          <p className="text-[var(--w360-text-muted)] mt-4 max-w-md">{p.body}</p>
          <ul className="mt-6 max-w-md divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
            {p.lines.map((line) => (
              <li key={line} className="py-3 text-sm">{line}</li>
            ))}
          </ul>
        </div>
        <figure className="rounded-[28px] bg-[var(--w360-tint)] p-6 sm:p-8 m-0">
          <div className="max-w-sm mx-auto">{p.art}</div>
          <figcaption className="text-center text-xs text-[var(--w360-tint-text)] mt-2 opacity-80">{p.caption}</figcaption>
        </figure>
      </div>
    </div>
  );
}
