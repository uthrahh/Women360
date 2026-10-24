import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";

// A plain-language draft of the rules for using the service. It describes the
// app as it is today and says what is still undecided instead of inventing
// legal detail (the operator, the governing law). It has not been reviewed by a
// lawyer and must be before the service is offered to the public.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-7 border-t border-[var(--w360-border)]">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[var(--w360-text-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  usePageTitle("Terms of use");
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 max-w-content mx-auto">
        <Link to="/" className="font-display text-xl font-semibold">Women360</Link>
        <ThemeToggle />
      </header>

      <main className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of use</h1>
        <p className="mt-4 text-[var(--w360-text-muted)] leading-relaxed">
          These are the plain-language rules for using Women360. They are a working draft that has not yet been
          reviewed by a lawyer, and some details are still to be confirmed (listed at the end).
        </p>

        <Section title="What Women360 is">
          <p>
            Women360 is a wellness and tracking tool. It helps you record and look back at your health information. It is
            not a medical device, it does not diagnose or treat anything, and it is not a method of birth control. If you
            are worried about your health, or have symptoms, speak to a doctor. In an emergency, contact your local
            emergency services.
          </p>
          <p>
            Check-up suggestions and observations come from general guidance and from what you enter. They are a prompt to
            ask a clinician, not advice for your situation.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Give accurate details, and keep your password to yourself. You are responsible for what happens under your account.</li>
            <li>You must be 18 or over to create an account.</li>
            <li>You can download your data or delete your account at any time in Settings, under Your data.</li>
            <li>A few shared demonstration accounts exist for evaluation. They hold synthetic data only, and you should not enter real personal information into them.</li>
          </ul>
        </Section>

        <Section title="Using the service fairly">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Don't try to reach anyone else's information, interfere with the service, or overload it.</li>
            <li>Don't use it to harass or deceive anyone, or break the law.</li>
            <li>Only share your information with a coach you trust. You decide who sees what, and you can stop at any time.</li>
          </ul>
          <p>We may suspend an account that puts the service or other people at risk.</p>
        </Section>

        <Section title="Availability">
          <p>
            Women360 currently runs on free hosting tiers. It can be slow to start after a quiet period, and it may be
            unavailable from time to time or change without notice. We take care with your data, but we don't promise the
            service will always be available, so keep your own copy of anything important by using the export in Settings.
          </p>
        </Section>

        <Section title="Your information">
          <p>
            How we handle your information is described in the <Link to="/privacy" className="underline underline-offset-2">privacy summary</Link>.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>If these terms change in a way that matters, we will say so in the app before the change takes effect.</p>
        </Section>

        <Section title="Still to be confirmed">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>The organisation that operates the service and how to contact it.</li>
            <li>Which country's law applies, and any regional requirements for where it is offered.</li>
            <li>Limits on liability and any paid features, which need a lawyer's review.</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
