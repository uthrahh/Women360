import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { HeroButton } from "@/components/ui/HeroButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import DitherVeil from "@/components/reactbits/DitherVeil";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import GooeyNav from "@/components/reactbits/GooeyNav";
import { portraitDataUri } from "./portrait";
import { useBrandColors } from "@/hooks/useBrandColors";
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

const NAV_ITEMS = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "Senior Mode", href: "#senior-mode" },
  { label: "Privacy", href: "#privacy" },
];

const REVEAL = { distance: 24, duration: 0.7, ease: "power2.out", threshold: 0.12 } as const;

export default function LandingPage() {
  const brand = useBrandColors();
  const portrait = useMemo(() => portraitDataUri(brand.dark), [brand.dark]);

  // The nav's pill follows the section being read: the last one whose top has
  // passed 40% of the way down the screen. Above the first one (the hero) it
  // rests on the first item, since one is always selected.
  const [section, setSection] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let active = 0;
      NAV_ITEMS.forEach((item, index) => {
        const el = document.getElementById(item.href.slice(1));
        if (el && el.getBoundingClientRect().top <= line) active = index;
      });
      setSection(active);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 border-b border-[var(--w360-border)] max-w-content mx-auto">
        <span className="font-display text-xl font-semibold">Women360</span>
        <div className="hidden sm:block">
          <GooeyNav
            items={NAV_ITEMS}
            activeIndex={section}
            onChange={setSection}
            size="sm"
            frame={false}
            theme={brand.dark ? "dark" : "light"}
            color={brand.accent}
            activeTextColor={brand.inkOnAccent}
            particleCount={10}
            spread={30}
            animationTime={500}
            style={{ ["--gn-ink" as string]: "var(--w360-text)", ["--gn-muted" as string]: "var(--w360-text-muted)" }}
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link to="/login" className="text-sm font-medium hidden sm:inline">Log in</Link>
          <Link to="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 sm:px-10 py-14 sm:py-20 max-w-content mx-auto grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-10 lg:gap-6 items-center">
        <AnimatedContent className="max-w-2xl" {...REVEAL} trigger="mount" stagger={0.09}>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-maroon-700 dark:text-maroon-300 mb-5">
            A personal health operating system
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight">
            How am I doing, what should I pay attention to, and what can I do next?
          </h1>
          <p className="text-lg text-[var(--w360-text-muted)] mt-6 max-w-xl">
            Women360 brings your cycle, nutrition, activity, sleep and wellbeing into one calm, honest view — built for every stage of your life, from your twenties to your nineties.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <HeroButton to="/register">Create your account <ArrowRight size={16} /></HeroButton>
            <HeroButton to="/login" variant="secondary">Log in</HeroButton>
          </div>
        </AnimatedContent>
        {/* Decorative: nothing on the page depends on it. Stippled in ink and paper
            until the cursor (or, on touch, a slow drift) lifts the colour. */}
        <div aria-hidden className="relative aspect-[4/5] w-full max-w-[440px] lg:max-w-none mx-auto rounded-[28px] overflow-hidden border border-[var(--w360-border)]">
          <DitherVeil
            src={portrait}
            fit="cover"
            pattern="floyd"
            pixelSize={3}
            inkColor={brand.dark ? "#15100E" : "#521626"}
            paperColor={brand.dark ? "#E6BFC9" : "#FBF8F4"}
            rimColor={brand.dark ? "#D0899A" : "#B85468"}
            rim={0.16}
            contrast={1.1}
            revealRadius={170}
            softness={0.7}
            linger={1.4}
            wander
          />
        </div>
      </section>

      {/* Product preview */}
      <section className="px-6 sm:px-10 pb-24 max-w-content mx-auto">
        <AnimatedContent {...REVEAL}>
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
        </AnimatedContent>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)]">
        <div className="max-w-content mx-auto">
          <h2 className="font-display text-3xl font-semibold max-w-md">Everything that makes up your health, in one place.</h2>
          <AnimatedContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-12" {...REVEAL} stagger={0.07}>
            {capabilities.map((c) => (
              <div key={c.title}>
                <c.icon size={22} strokeWidth={1.6} className="text-maroon-700 dark:text-maroon-300 mb-3" />
                <h3 className="font-medium">{c.title}</h3>
                <p className="text-sm text-[var(--w360-text-muted)] mt-1.5">{c.desc}</p>
              </div>
            ))}
          </AnimatedContent>
        </div>
      </section>

      {/* Life course */}
      <section className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)] bg-[var(--w360-bg-warm)]">
        <div className="max-w-content mx-auto">
          <h2 className="font-display text-3xl font-semibold max-w-md">Built for the whole of a woman's life — 18 to 100.</h2>
          <AnimatedContent className="grid sm:grid-cols-4 gap-6 mt-12" {...REVEAL} stagger={0.09}>
            {lifeStages.map((l) => (
              <div key={l.stage} className="border-t-2 border-maroon-700 dark:border-maroon-300 pt-4">
                <p className="font-display text-2xl font-semibold">{l.stage}</p>
                <p className="text-sm text-[var(--w360-text-muted)] mt-1.5">{l.note}</p>
              </div>
            ))}
          </AnimatedContent>
        </div>
      </section>

      {/* Senior Mode USP */}
      <section id="senior-mode" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)]">
        <AnimatedContent className="max-w-content mx-auto grid lg:grid-cols-2 gap-12 items-center" {...REVEAL} stagger={0.15}>
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
        </AnimatedContent>
      </section>

      {/* Privacy */}
      <section id="privacy" className="px-6 sm:px-10 py-20 border-t border-[var(--w360-border)] bg-[var(--w360-bg-warm)]">
        <AnimatedContent className="max-w-content mx-auto max-w-2xl" {...REVEAL}>
          <h2 className="font-display text-2xl font-semibold">Your health information stays yours.</h2>
          <p className="text-[var(--w360-text-muted)] mt-3">
            Coaches only see what you choose to share. Women360 is a wellness and tracking tool, not a diagnostic system — it points you toward professional care rather than replacing it.
          </p>
        </AnimatedContent>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-24 text-center">
        <AnimatedContent {...REVEAL}>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold max-w-lg mx-auto">Start with today's snapshot.</h2>
        <Link to="/register" className="inline-block mt-8"><Button size="lg">Create your account</Button></Link>
        </AnimatedContent>
      </section>

      <footer className="px-6 sm:px-10 py-8 border-t border-[var(--w360-border)] text-sm text-[var(--w360-text-muted)] flex items-center justify-between max-w-content mx-auto">
        <span>Women360</span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-[var(--w360-text)] underline underline-offset-2">Privacy</Link>
          <span>© 2026 · A wellness & tracking product, not a diagnostic service</span>
        </span>
      </footer>
    </div>
  );
}
