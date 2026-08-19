import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Moon, Activity, Apple, CalendarHeart, Smile, ShieldCheck, ArrowRight } from "lucide-react";

const capabilities = [
  { icon: CalendarHeart, title: "Menstrual health", desc: "Cycle tracking, symptoms and elegant, honest trend reading — never a diagnosis." },
  { icon: Apple, title: "Nutrition", desc: "Meals, hydration and the nutrients that matter, logged in seconds." },
  { icon: Activity, title: "Activity", desc: "Steps, workouts, strength and mobility, in context." },
  { icon: Moon, title: "Sleep", desc: "Duration, quality and consistency, tracked over time." },
  { icon: Smile, title: "Wellbeing", desc: "Mood, stress and energy — a calm place to check in." },
  { icon: ShieldCheck, title: "Preventive health", desc: "Screenings and checkups, reminded at the right time." },
];

const lifeStages = [
  { stage: "18–30", note: "Cycle awareness, fitness foundations, reproductive health" },
  { stage: "30–45", note: "Fertility, nutrition, stress and sleep under real-life load" },
  { stage: "45–60", note: "Perimenopause, bone health, strength, hormonal shifts" },
  { stage: "60+", note: "Preventive screenings, mobility, simplicity — Senior Mode" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 border-b border-[var(--w360-border)] max-w-content mx-auto">
        <span className="font-display text-xl font-semibold">Women360</span>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-[var(--w360-text-muted)]">
          <a href="#capabilities" className="hover:text-[var(--w360-text)]">Capabilities</a>
          <a href="#senior-mode" className="hover:text-[var(--w360-text)]">Senior Mode</a>
          <a href="#privacy" className="hover:text-[var(--w360-text)]">Privacy</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium hidden sm:inline">Log in</Link>
          <Link to="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 sm:px-10 py-20 sm:py-28 max-w-content mx-auto">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-maroon-700 dark:text-maroon-300 mb-5">
            A personal health operating system
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight">
            How am I doing, what should I pay attention to, and what can I do next?
          </h1>
          <p className="text-lg text-[var(--w360-text-muted)] mt-6 max-w-xl">
            Women360 brings your cycle, nutrition, activity, sleep and wellbeing into one calm, honest view — built for every stage of your life, from your twenties to your nineties.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <Link to="/register"><Button size="lg">Create your account <ArrowRight size={16} /></Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary">Log in</Button></Link>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="px-6 sm:px-10 pb-24 max-w-content mx-auto">
        <div className="rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-warm)] p-2 sm:p-3">
          <div className="rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] p-6 sm:p-10">
            <div className="grid sm:grid-cols-3 gap-4">
              {["Sleep · 6.6h", "Steps · 6,240", "Cycle · Day 21"].map((s) => (
                <div key={s} className="border border-[var(--w360-border)] rounded-md p-4">
                  <p className="text-xs text-[var(--w360-text-muted)] mb-2">Snapshot</p>
                  <p className="font-display text-lg font-semibold">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)]">
        <div className="max-w-content mx-auto">
          <h2 className="font-display text-3xl font-semibold max-w-md">Everything that makes up your health, in one place.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
            {capabilities.map((c) => (
              <div key={c.title}>
                <c.icon size={22} strokeWidth={1.6} className="text-maroon-700 dark:text-maroon-300 mb-3" />
                <h3 className="font-medium">{c.title}</h3>
                <p className="text-sm text-[var(--w360-text-muted)] mt-1.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Life course */}
      <section className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)] bg-[var(--w360-bg-warm)]">
        <div className="max-w-content mx-auto">
          <h2 className="font-display text-3xl font-semibold max-w-md">Built for the whole of a woman's life — 18 to 100.</h2>
          <div className="grid sm:grid-cols-4 gap-6 mt-12">
            {lifeStages.map((l) => (
              <div key={l.stage} className="border-t-2 border-maroon-700 dark:border-maroon-300 pt-4">
                <p className="font-display text-2xl font-semibold">{l.stage}</p>
                <p className="text-sm text-[var(--w360-text-muted)] mt-1.5">{l.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Senior Mode USP */}
      <section id="senior-mode" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)]">
        <div className="max-w-content mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-maroon-700 dark:text-maroon-300 mb-4">Senior Mode</p>
            <h2 className="font-display text-3xl font-semibold">Not a bigger font. A different way of using the app.</h2>
            <p className="text-[var(--w360-text-muted)] mt-4 max-w-md">
              Turn it on and Women360 becomes a handful of large, clearly-labelled essentials — chosen by you — instead of a full dashboard. Fewer taps, no clutter, nothing essential hidden.
            </p>
            <Link to="/register" className="inline-block mt-6">
              <Button variant="secondary">See it in your account</Button>
            </Link>
          </div>
          <div className="border-2 border-[var(--w360-border)] rounded-[16px] p-6 bg-[var(--w360-bg-raised)]">
            <p className="font-display text-xl font-semibold mb-4">MY HEALTH</p>
            <div className="flex flex-col gap-2.5">
              {["How I'm Doing", "My Medicines", "My Appointments", "My Activity"].map((s) => (
                <div key={s} className="px-5 py-4 rounded-[12px] border-2 border-[var(--w360-border)] font-medium">{s}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)] bg-[var(--w360-bg-warm)]">
        <div className="max-w-content mx-auto max-w-2xl">
          <h2 className="font-display text-2xl font-semibold">Your health information stays yours.</h2>
          <p className="text-[var(--w360-text-muted)] mt-3">
            Coaches only see what you choose to share. Women360 is a wellness and tracking tool, not a diagnostic system — it points you toward professional care rather than replacing it.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold max-w-lg mx-auto">Start with today's snapshot.</h2>
        <Link to="/register" className="inline-block mt-8"><Button size="lg">Create your account</Button></Link>
      </section>

      <footer className="px-6 sm:px-10 py-8 border-t border-[var(--w360-border)] text-sm text-[var(--w360-text-muted)] flex items-center justify-between max-w-content mx-auto">
        <span>Women360</span>
        <span>© 2026 · A wellness & tracking product, not a diagnostic service</span>
      </footer>
    </div>
  );
}
