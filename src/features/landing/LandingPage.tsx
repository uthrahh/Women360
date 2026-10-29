import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { buttonClasses } from "@/components/ui/Button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { warmUpApi } from "@/services/apiClient";
import { cn } from "@/lib/utils";

// The public landing page. It has one job: help a woman see what Women360 does that a
// plain tracker doesn't, and start. So it leads with prevention (check-ups, patterns worth a
// doctor's time, plans), says plainly who it is for and how her data is treated, answers the
// four questions people actually ask, and stops. Nothing here is real user data: the phone is
// an illustration and says so, and there are no testimonials, counts or ratings.

const REVEAL = { distance: 24, duration: 0.7, ease: "power2.out", threshold: 0.12 } as const;
const SOFT_SHADOW = "shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]";
const SIGNATURE_ITALIC = "font-display italic font-normal";
const H2 = "font-display text-3xl sm:text-4xl font-semibold tracking-tight [text-wrap:balance]";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Every line is something the app does today. The check-up and pattern rules are marked as
// not yet reviewed by a clinician inside the app, and the FAQ below says so.
const POINTS = [
  {
    title: "Check-ups, when they're due",
    body: "See the screenings suggested for your age, with the source named. Record the ones you've had and the next date is worked out for you.",
  },
  {
    title: "Patterns worth a conversation",
    body: "When your own logs cross a published guideline line, such as long or irregular cycles, you see your numbers beside it and a suggestion to talk to a doctor. Never a diagnosis.",
  },
  {
    title: "A cycle you can plan around",
    body: "Your next period as a range from your own history, not a false-precision date. Log only the day it starts and the rest follows.",
  },
  {
    title: "A plan for a goal, when you ask",
    body: "Pick a goal and get a week-by-week activity plan built from what you already do, your time and your age, with an honest view of how realistic it is.",
  },
  {
    title: "If you live with a condition",
    body: "Tell Women360 about PCOS, endometriosis or a thyroid condition and it suggests the symptoms worth noting and prepares a summary for your doctor.",
  },
  {
    title: "Quick to log, kind when you don't",
    body: "One tap for a habit or a meal you've had before. Miss a day and nothing happens: there are no streaks to lose.",
  },
];

const TRUST = [
  {
    title: "Yours to take or erase",
    body: "Download everything held about your account, or delete it completely, from Settings whenever you like.",
  },
  {
    title: "Shared only if you choose",
    body: "A wellness coach sees a limited summary, and only when you give access. Your health profile and medicines are never part of it.",
  },
  {
    title: "Honest about what it is",
    body: "A wellness and tracking tool, not a diagnostic service. It points you toward professional care rather than replacing it.",
  },
];

const FAQ = [
  {
    q: "Is Women360 medical advice?",
    a: "No. It's a wellness and tracking tool. It can show patterns in what you log and remind you about check-ups, but it doesn't diagnose anything and it isn't a substitute for a doctor.",
  },
  {
    q: "What do the check-up reminders follow?",
    a: "India's national screening programme and WHO guidance, with the source named beside each. They are currently marked as not yet reviewed by a clinician, so treat them as a starting point and confirm them with your doctor.",
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

function Nav() {
  return (
    <header className="sticky top-4 z-40 px-4">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto max-w-4xl flex items-center justify-between gap-3 rounded-full border border-[var(--w360-border)] bg-[var(--w360-nav-surface)] backdrop-blur-[20px] pl-4 pr-2 py-2",
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
          <a href="#what" className="hover:text-[var(--w360-text)]">What it does</a>
          <a href="#every-age" className="hover:text-[var(--w360-text)]">Every age</a>
          <a href="#privacy" className="hover:text-[var(--w360-text)]">Privacy</a>
          <a href="#questions" className="hover:text-[var(--w360-text)]">Questions</a>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link to="/login" className="hidden sm:inline text-sm font-medium px-3 py-2 rounded-full hover:bg-[var(--w360-bg-warm)]">Log in</Link>
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

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      aria-hidden
      className="shrink-0 w-[280px] sm:w-[300px] h-[460px] sm:h-[520px] rounded-[2.75rem] border-[6px] border-[var(--w360-text)] bg-[var(--w360-tint)] overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,0.25)]"
    >
      <div className="px-5 pt-9 pb-6 h-full flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--w360-tint-text)]">{label}</p>
        {children}
      </div>
    </div>
  );
}

const ROW = "flex items-center justify-between gap-3 rounded-2xl bg-[var(--w360-bg-raised)] px-4 py-3 text-sm";
const ROW_STACK = "flex flex-col gap-0.5 rounded-2xl bg-[var(--w360-bg-raised)] px-4 py-3 text-sm mt-2";

/** One illustrated screen: a day's few taps, the cycle as a range, a check-up that is due. */
function HeroPhone() {
  return (
    <div className="flex flex-col items-center">
      <Phone label="Today">
        <p className="font-display text-3xl font-semibold leading-tight mt-1 text-[var(--w360-tint-text)]">Three small things.</p>
        <div className="flex flex-col gap-2">
          {["Walk 10,000 steps", "Take my vitamin", "Stretch for five minutes"].map((h, i) => (
            <div key={h} className={ROW}>
              <span>{h}</span>
              <span className={cn("w-5 h-5 rounded-full border-2 border-[var(--w360-accent)]", i === 1 && "bg-[var(--w360-accent)]")} />
            </div>
          ))}
        </div>
        <div className={ROW_STACK}>
          <span>Next period</span>
          <span className="text-xs text-[var(--w360-text-muted)]">In about 5 days, give or take</span>
        </div>
        <div className={ROW}>
          <span>Blood pressure</span>
          <span className="text-xs rounded-full bg-[var(--w360-tint)] text-[var(--w360-tint-text)] px-2 py-0.5 border border-[var(--w360-border)]">Check-up due</span>
        </div>
      </Phone>
      <p className="text-xs text-[var(--w360-text-muted)] mt-4">Illustration of the app. No real data is shown.</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-t border-[var(--w360-border)] last:border-b">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-4 py-5 text-left font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
        >
          {q}
          <Plus size={20} aria-hidden className={cn("shrink-0 transition-transform duration-300 ease-in-out", open && "rotate-45")} />
        </button>
      </h3>
      {/* Animating grid rows takes the panel from 0 to its natural height. */}
      <div
        id={id}
        role="region"
        aria-label={q}
        aria-hidden={!open}
        className={cn("grid transition-[grid-template-rows] duration-300 ease-in-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-[var(--w360-text-muted)] leading-relaxed max-w-prose">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  usePageTitle();
  useEffect(warmUpApi, []);
  return (
    <div className="min-h-screen bg-[var(--w360-bg)] text-[var(--w360-text)] overflow-x-clip">
      <Grain />
      <Nav />
      <main>
        {/* Hero */}
        <section className="px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-8 items-center">
            <AnimatedContent {...REVEAL} trigger="mount" stagger={0.1} className="text-center lg:text-left">
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.04] [text-wrap:balance]">
                A calmer way to look after <span className={cn(SIGNATURE_ITALIC, "text-[var(--w360-accent)]")}>your</span> health.
              </h1>
              <p className="text-lg text-[var(--w360-text-muted)] mt-7 max-w-xl mx-auto lg:mx-0">
                Log your cycle, meals, movement, sleep and mood in a few taps. Women360 turns what you log into early, plain-language nudges: which check-ups are due, and patterns worth taking to a doctor.
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 mt-9">
                <Link to="/register" className={cn(buttonClasses({ size: "lg" }), SOFT_SHADOW)}>Create your account</Link>
                <a href="#what" className="text-sm font-medium underline underline-offset-4 hover:text-[var(--w360-accent)]">See what it does</a>
              </div>
              <p className="text-sm text-[var(--w360-text-muted)] mt-6">
                No watch or device needed. Download or delete your data whenever you like.
              </p>
            </AnimatedContent>
            <AnimatedContent {...REVEAL} trigger="mount" className="flex justify-center lg:justify-end">
              <HeroPhone />
            </AnimatedContent>
          </div>
        </section>

        {/* What it does */}
        <section id="what" className="px-4 py-20 border-t border-[var(--w360-border)]">
          <div className="max-w-5xl mx-auto">
            <AnimatedContent {...REVEAL}>
              <h2 className={cn(H2, "max-w-xl")}>Made to help you act early, not just keep a log.</h2>
              <p className="text-[var(--w360-text-muted)] mt-4 max-w-xl">
                Cycle, nutrition, activity, sleep, mood, medicines and appointments in one place, and the things below on top of them.
              </p>
            </AnimatedContent>
            <AnimatedContent className="grid sm:grid-cols-2 gap-x-14 gap-y-10 mt-14" {...REVEAL} stagger={0.06}>
              {POINTS.map((p) => (
                <div key={p.title} className="border-t border-[var(--w360-border)] pt-5">
                  <h3 className="font-medium text-lg">{p.title}</h3>
                  <p className="text-[var(--w360-text-muted)] mt-2 max-w-md">{p.body}</p>
                </div>
              ))}
            </AnimatedContent>
          </div>
        </section>

        {/* Every age / Senior Mode */}
        <section id="every-age" className="px-4 py-20">
          <AnimatedContent className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-center rounded-[2.5rem] bg-[var(--w360-bg-warm)] border border-[var(--w360-border)] px-6 sm:px-12 py-14" {...REVEAL} stagger={0.15}>
            <div>
              <h2 className={H2}>Made for every stage, from 18 to 100.</h2>
              <p className="text-[var(--w360-text-muted)] mt-4 max-w-md">
                Senior Mode turns Women360 into a handful of large, clearly labelled essentials that you choose yourself. It's a different way of using the app, not just a bigger font.
              </p>
              <Link to="/register" className="inline-block mt-6 text-sm font-medium underline underline-offset-4 hover:text-[var(--w360-accent)]">
                See it in your account
              </Link>
            </div>
            <div aria-hidden className={cn("rounded-[2rem] border-2 border-[var(--w360-border)] bg-[var(--w360-bg-raised)] p-6", SOFT_SHADOW)}>
              <p className="font-display text-xl font-semibold mb-4">MY HEALTH</p>
              <div className="flex flex-col gap-2.5">
                {["How I'm Doing", "My Medicines", "My Appointments", "My Activity"].map((t) => (
                  <div key={t} className="px-5 py-4 rounded-2xl border-2 border-[var(--w360-border)] font-medium">{t}</div>
                ))}
              </div>
            </div>
          </AnimatedContent>
        </section>

        {/* Privacy */}
        <section id="privacy" className="px-4 py-20">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <AnimatedContent {...REVEAL}>
              <h2 className={H2}>Your health information stays yours.</h2>
              <Link to="/privacy" className="inline-block mt-5 underline underline-offset-4 text-sm font-medium">
                Read how your data is handled
              </Link>
            </AnimatedContent>
            <AnimatedContent {...REVEAL} stagger={0.08} className="flex flex-col">
              {TRUST.map((t) => (
                <div key={t.title} className="border-t border-[var(--w360-border)] py-5 first:pt-0 first:border-t-0 lg:first:border-t lg:first:pt-5">
                  <h3 className="font-medium text-lg">{t.title}</h3>
                  <p className="text-[var(--w360-text-muted)] mt-1.5 max-w-md">{t.body}</p>
                </div>
              ))}
            </AnimatedContent>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="px-4 py-20">
          <AnimatedContent {...REVEAL} className="max-w-2xl mx-auto">
            <h2 className={cn(H2, "mb-8")}>Questions, answered plainly.</h2>
            <div>
              {FAQ.map((f) => (
                <FaqItem key={f.q} {...f} />
              ))}
            </div>
          </AnimatedContent>
        </section>

        {/* Get started */}
        <section className="px-4 py-24 text-center">
          <AnimatedContent {...REVEAL} className="max-w-xl mx-auto">
            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">Start with today.</h2>
            <Link to="/register" className={cn(buttonClasses({ size: "lg" }), SOFT_SHADOW, "mt-8")}>
              Create your account
            </Link>
          </AnimatedContent>
        </section>
      </main>

      <footer className="px-4 py-8 text-sm text-[var(--w360-text-muted)] text-center">
        <Link to="/privacy" className="underline underline-offset-2 hover:text-[var(--w360-text)]">Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="underline underline-offset-2 hover:text-[var(--w360-text)]">Terms</Link>
        <span className="mx-2">·</span>
        <span>© 2026 · A wellness and tracking product, not a diagnostic service</span>
      </footer>
    </div>
  );
}
