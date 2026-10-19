import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { buttonClasses } from "@/components/ui/Button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

// A calmer, slower take on the landing page: a floating pill nav, drifting soft
// blobs, a paper-like grain, a row of everyday moments, an app preview, example
// entries and an FAQ. It keeps Women360's own palette and type; the layout,
// grain and pacing are the new part. Nothing here is real user data: the phones
// are illustrations and the notes are labelled as examples.

const REVEAL = { distance: 30, duration: 0.8, ease: "power2.out", threshold: 0.12 } as const;
const SOFT_SHADOW = "shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]";
const SIGNATURE_ITALIC = "font-display italic font-normal";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const MOMENTS = [
  { when: "Morning", text: "Tick off today's medicine in one tap." },
  { when: "After lunch", text: "Log a meal you've had before without retyping it." },
  { when: "Evening", text: "Say how you feel, then try two minutes of slow breathing." },
  { when: "When you wake", text: "Note how you slept, with a rating that's yours." },
  { when: "Any day", text: "See your next period as a range, not a false-precision date." },
  { when: "Once a year", text: "See which check-ups are due, and record the ones you've had." },
];

const NOTES = [
  {
    tag: "Example entry",
    text: "Slept about seven hours and woke once. Mood okay, a little tired. Walked after lunch. Took the vitamin.",
    sign: "Sleep, mood, movement",
    tilt: "md:-rotate-1",
  },
  {
    tag: "Example entry",
    text: "Period due in about four days, give or take. Headache this morning. Drank more water than yesterday.",
    sign: "Cycle, symptoms, water",
    tilt: "md:rotate-1",
  },
];

const FAQ = [
  {
    q: "Is Women360 medical advice?",
    a: "No. It's a wellness and tracking tool. It can show patterns in what you log and remind you about check-ups, but it doesn't diagnose anything and it isn't a substitute for a doctor.",
  },
  {
    q: "What do the check-up reminders follow?",
    a: "India's national screening programme and WHO guidance. They are currently marked as not yet reviewed by a clinician, so treat them as a starting point and confirm them with your doctor.",
  },
  {
    q: "Can I take my data with me, or delete it?",
    a: "Yes. In Settings, under Your data, you can download everything held about your account, or erase your account completely.",
  },
  {
    q: "Is it only for younger women?",
    a: "No. It's built for adults of every age. Senior Mode turns the app into a few large, clearly labelled essentials that you choose yourself.",
  },
  {
    q: "Do I need a watch or another device?",
    a: "No. You log things yourself, in a few taps. Nothing has to be connected.",
  },
  {
    q: "What happens if I miss a day?",
    a: "Nothing. There's no scolding and no lost-streak message. The count simply starts again when you do.",
  },
];

/** The paper texture. Fixed over the page, never catches a tap or a click. */
function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.35] dark:opacity-20 mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

function Blob({ className, color, delay = "0s" }: { className: string; color: string; delay?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute rounded-full blur-3xl opacity-60 motion-safe:animate-[w360-float_6s_ease-in-out_infinite_alternate]", className)}
      style={{ background: color, animationDelay: delay }}
    />
  );
}

function Nav() {
  return (
    <header className="sticky top-4 z-40 px-4">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto max-w-3xl flex items-center justify-between gap-3 rounded-full border border-[var(--w360-border)] bg-[var(--w360-nav-surface)] backdrop-blur-[20px] pl-4 pr-2 py-2",
          SOFT_SHADOW
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 rounded-full">
          <span aria-hidden className="grid place-items-center w-7 h-7 rounded-full bg-[var(--w360-accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--w360-bg-raised)]" />
          </span>
          <span className="font-display text-lg font-semibold">Women360</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-[var(--w360-text-muted)]">
          <a href="#moments" className="hover:text-[var(--w360-text)]">Moments</a>
          <a href="#preview" className="hover:text-[var(--w360-text)]">Preview</a>
          <a href="#questions" className="hover:text-[var(--w360-text)]">Questions</a>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            to="/register"
            className="rounded-full bg-[var(--w360-text)] text-[var(--w360-bg)] text-sm font-medium px-4 py-2 transition-transform hover:scale-[1.03]"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Phone({ className, children, label }: { className?: string; children: ReactNode; label: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "shrink-0 rounded-[2.75rem] border-[6px] border-[var(--w360-text)] bg-[var(--w360-bg-raised)] overflow-hidden",
        "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      <div className="px-5 pt-9 pb-6 h-full flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--w360-text-muted)]">{label}</p>
        {children}
      </div>
    </div>
  );
}

const ROW = "flex items-center justify-between gap-3 rounded-2xl bg-[var(--w360-bg-raised)] px-4 py-3 text-sm";

function Preview() {
  return (
    <section id="preview" className="px-4 py-24 overflow-hidden">
      <AnimatedContent {...REVEAL} className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">One quiet place for your day.</h2>
        <p className="text-[var(--w360-text-muted)] mt-4 max-w-md mx-auto">Open it, tap what you've done, and get on with your day.</p>
      </AnimatedContent>

      <AnimatedContent {...REVEAL} className="mt-16 flex items-start justify-center">
        <Phone
          label="Habits"
          className="hidden lg:block w-[280px] h-[580px] opacity-80 translate-y-12 -mr-10 bg-[var(--w360-bg-warm)]"
        >
          {["Walk 10,000 steps", "Take my vitamin", "Stretch for five minutes"].map((h, i) => (
            <div key={h} className={ROW}>
              <span>{h}</span>
              <span
                className={cn(
                  "w-5 h-5 rounded-full border-2 border-[var(--w360-accent)]",
                  i === 1 && "bg-[var(--w360-accent)]"
                )}
              />
            </div>
          ))}
        </Phone>

        <Phone label="Today" className="relative z-10 w-[300px] h-[620px] bg-[var(--w360-tint)]">
          <p className="font-display text-3xl font-semibold leading-tight mt-2 text-[var(--w360-tint-text)]">How are you feeling?</p>
          <p className="text-sm text-[var(--w360-tint-text)] opacity-80">Two minutes is enough.</p>
          <div className="flex-1 grid place-items-center">
            <span className="grid place-items-center w-36 h-36 rounded-full bg-[var(--w360-accent)] text-[var(--w360-bg-raised)] font-medium motion-safe:animate-[w360-pulse_4s_ease-in-out_infinite]">
              Breathe
            </span>
          </div>
        </Phone>

        <Phone
          label="Check-ups"
          className="hidden lg:block w-[280px] h-[580px] opacity-80 translate-y-24 -ml-10 bg-[var(--w360-bg-warm)]"
        >
          {["Blood pressure", "Blood sugar", "Cervical screening"].map((c) => (
            <div key={c} className={ROW}>
              <span>{c}</span>
              <span className="text-xs rounded-full bg-[var(--w360-tint)] text-[var(--w360-tint-text)] px-2 py-0.5">Not recorded yet</span>
            </div>
          ))}
        </Phone>
      </AnimatedContent>
      <p className="text-center text-xs text-[var(--w360-text-muted)] mt-10 lg:mt-28">
        Illustration of the app. No real data is shown.
      </p>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-2xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)]">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-4 p-6 text-left font-medium rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
        >
          {q}
          <Plus size={20} aria-hidden className={cn("shrink-0 transition-transform duration-500 ease-in-out", open && "rotate-45")} />
        </button>
      </h3>
      {/* Animating grid rows takes the panel from 0 to its natural height. */}
      <div
        id={id}
        role="region"
        aria-label={q}
        aria-hidden={!open}
        className={cn("grid transition-[grid-template-rows] duration-500 ease-in-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[var(--w360-text-muted)] leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function SoftlyPage() {
  usePageTitle();
  return (
    <div className="min-h-screen bg-[var(--w360-bg)] text-[var(--w360-text)] overflow-x-clip">
      <Grain />
      <Nav />

      {/* Hero */}
      <section className="relative px-4 pt-20 pb-24 sm:pt-28 text-center overflow-hidden">
        <Blob className="w-[360px] h-[360px] -top-10 -left-24" color="var(--w360-tint)" />
        <Blob
          className="w-[320px] h-[320px] top-24 -right-20"
          color="color-mix(in srgb, var(--w360-accent) 22%, var(--w360-bg))"
          delay="-3s"
        />
        <AnimatedContent {...REVEAL} trigger="mount" stagger={0.1} className="relative max-w-3xl mx-auto">
          <p className="text-sm font-medium text-[var(--w360-text-muted)] mb-6">For every stage of your life</p>
          <h1 className="font-display text-5xl sm:text-7xl md:text-[5.5rem] font-semibold tracking-tight leading-[1.02]">
            A calmer way to look after <span className={cn(SIGNATURE_ITALIC, "text-[var(--w360-accent)]")}>your</span> health.
          </h1>
          <p className="text-lg text-[var(--w360-text-muted)] mt-8 max-w-[500px] mx-auto">
            Your cycle, sleep, food, movement and check-ups in one quiet place, with the fewest taps we can manage.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
            <Link to="/register" className={cn(buttonClasses({ size: "lg" }), SOFT_SHADOW)}>Create your account</Link>
            <Link to="/login" className={buttonClasses({ size: "lg", variant: "secondary" })}>Log in</Link>
          </div>
        </AnimatedContent>
      </section>

      {/* Moments */}
      <section id="moments" className="py-16">
        <AnimatedContent {...REVEAL} className="px-4 max-w-3xl mx-auto mb-8">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Small moments, small taps.</h2>
        </AnimatedContent>
        <div
          role="region"
          aria-label="Everyday moments. Scroll sideways to see more."
          tabIndex={0}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 pb-6 w360-hide-scrollbar focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)] rounded-3xl"
        >
          {MOMENTS.map((m) => (
            <article
              key={m.when}
              className={cn(
                "group snap-start shrink-0 w-72 h-40 rounded-3xl bg-[var(--w360-bg-raised)] border border-[var(--w360-border)] p-5 flex flex-col justify-between",
                SOFT_SHADOW
              )}
            >
              <p className="text-sm text-[var(--w360-text-muted)]">{m.when}</p>
              <p className="text-xl leading-snug transition-colors duration-300 group-hover:text-[var(--w360-accent)]">{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <Preview />

      {/* Example entries */}
      <section className="px-4 py-20">
        <AnimatedContent {...REVEAL} className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">What a day's notes can look like.</h2>
          <p className="text-[var(--w360-text-muted)] mt-3 max-w-md">Written as examples, not by real people.</p>
        </AnimatedContent>
        <AnimatedContent {...REVEAL} stagger={0.12} className="max-w-3xl mx-auto mt-10 grid md:grid-cols-2 gap-6">
          {NOTES.map((n) => (
            <figure
              key={n.text}
              className={cn("rounded-[2rem] bg-[var(--w360-bg-raised)] border border-[var(--w360-border)] p-8", SOFT_SHADOW, n.tilt)}
            >
              <figcaption className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--w360-text-muted)]">{n.tag}</figcaption>
              <blockquote className="text-xl leading-relaxed mt-4">{n.text}</blockquote>
              <p className="flex items-center gap-3 mt-6 text-[var(--w360-text-muted)]">
                <span aria-hidden className="w-8 h-px bg-current" />
                <span className={cn(SIGNATURE_ITALIC, "text-xl")}>{n.sign}</span>
              </p>
            </figure>
          ))}
        </AnimatedContent>
      </section>

      {/* Questions */}
      <section id="questions" className="px-4 py-20">
        <AnimatedContent {...REVEAL} className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-center">Questions, answered plainly.</h2>
          <div className="flex flex-col gap-3 mt-10">
            {FAQ.map((f) => (
              <FaqItem key={f.q} {...f} />
            ))}
          </div>
        </AnimatedContent>
      </section>

      {/* Get started */}
      <section className="relative px-4 py-28 text-center overflow-hidden">
        <Blob className="w-[380px] h-[380px] -bottom-24 -left-20" color="var(--w360-tint)" />
        <Blob className="w-[320px] h-[320px] -bottom-10 -right-16" color="color-mix(in srgb, var(--w360-accent) 22%, var(--w360-bg))" delay="-3s" />
        <AnimatedContent {...REVEAL} className="relative max-w-xl mx-auto">
          <span aria-hidden className="relative mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-[var(--w360-text)]">
            <span className="w-3 h-3 rounded-full bg-[var(--w360-accent)]" />
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-8">Start with today.</h2>
          <p className="text-[var(--w360-text-muted)] mt-4">Your data stays yours: download it or delete it whenever you like.</p>
          <Link
            to="/register"
            className="inline-block mt-8 rounded-full bg-[var(--w360-text)] text-[var(--w360-bg)] font-medium px-8 py-4 transition-transform duration-300 hover:scale-105"
          >
            Create your account
          </Link>
        </AnimatedContent>
      </section>

      <footer className="px-4 py-8 text-sm text-[var(--w360-text-muted)] text-center">
        <Link to="/privacy" className="underline underline-offset-2 hover:text-[var(--w360-text)]">Privacy</Link>
        <span className="mx-2">·</span>
        <span>A wellness and tracking product, not a diagnostic service</span>
      </footer>
    </div>
  );
}
