import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/config/site";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";
import { analyticsEnabled } from "@/lib/analytics/ga";

// Plain-language account of what the app actually does with data. Every
// statement here is backed by the code or the hosting setup; anything that
// isn't settled is listed under "Still to be confirmed" rather than promised.
// This is a working summary, not legal advice — it needs review before launch.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-7 border-t border-[var(--w360-border)]">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[var(--w360-text-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  usePageTitle("Privacy");
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 max-w-content mx-auto">
        <Link to="/" className="font-display text-xl font-semibold">Women360</Link>
        <ThemeToggle />
      </header>

      <main className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto">
        <h1 className="font-display text-4xl font-semibold tracking-tight">How Women360 handles your information</h1>
        <p className="mt-4 text-[var(--w360-text-muted)] leading-relaxed">
          This is a plain-language summary of what the app does with your data today. It is a working draft that
          still needs legal review, and it describes the app as it is now, not what it might become.
        </p>

        <Section title="What we keep">
          <p>
            <span className="text-[var(--w360-text)] font-medium">Your account:</span> name, email, date of birth and a
            one-way hash of your password. We can't read your password.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">What you log:</span> cycle, meals and hydration,
            activity, sleep, mood and wellbeing, goals and check-ins, medicines and doses, appointments, measurements,
            your emergency contact, contraception and pregnancy status if you choose to record them, notes a coach writes about you, and any feedback you send.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">Reminder devices:</span> only if you turn on reminders
            for when Women360 is closed. For each device we keep the address your browser gives us for it, the keys that
            let us send to it, and your time zone. We use them only to send the reminders you set, and the notification
            doesn't say what a reminder is for. You can turn it off per device under Settings, Reminders, and it is
            removed if you delete your account.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">Save receipts:</span> when you save something, the app sends a one-time label with it, and we keep
            that label and the answer we gave you for 24 hours, so a save that is repeated by a dropped connection or a double tap is not recorded twice. They are
            then deleted, and sooner if you delete your account.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">Security records:</span> sign-in successes and
            failures, with a shortened IP address and no email or password, kept for 90 days.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            You can. Nobody else can unless you grant it. A wellness coach you give access to sees a limited summary
            (goals, wellbeing, sleep, activity and coaching appointments) and can be removed at any time. Your health
            profile and medicines are never part of that summary. You give a coach access under Settings, Privacy &amp;
            sharing, by entering their email, and you can stop sharing there whenever you like. Every time a coach opens
            your summary or writes a note, it is recorded in an audit log.
          </p>
          <p>
            Women360 doesn't sell your data and doesn't show advertising. Your sign-in is kept in your browser's own storage on your device.
            {analyticsEnabled()
              ? " Inside your account the site sets no cookies and uses no third-party analytics or tracking tools."
              : " The site sets no cookies and uses no third-party analytics or tracking tools."}
          </p>
          {analyticsEnabled() && (
            <p>
              <span className="text-[var(--w360-text)] font-medium">Google Analytics, only if you say yes.</span> On the public pages (the home page, privacy,
              terms and release notes) we ask whether you are happy for Google Analytics to count visits and which links are used. Nothing is loaded from Google, and
              no Google cookie is set, until you accept. It is never used inside your account or on the sign-in pages, and it never receives anything you log, type or
              copy, only how long a search or copied text was. Advertising features are off. Declining, or a browser that sends Do Not Track, means none of this
              happens, and you can change your choice from the footer of the home page.
            </p>
          )}
          <p>
            Women360 does keep simple counts of its own so we can see which parts are used: how often each screen is
            opened and each action is done, and how many different people used the app on a day. A count never says who. It
            holds no name, email, account id, address or device, and "different people" is worked out with a one-way code
            that is thrown away, with the codes, at the end of each day. Staff and demonstration accounts aren't counted,
            and neither is a browser that asks not to be tracked.
          </p>
        </Section>

        <Section title="Services that handle it for us">
          <p>
            The website is delivered by Vercel, the application server runs on Render, and the database is hosted by
            Supabase. The fonts are served from Women360 itself, so no font provider sees your visit. If you turn on reminders for when Women360 is closed, they travel through your browser's own notification service (Google for Chrome, Mozilla for Firefox, Apple for Safari). It sees that a notification was sent to your device, but the message is encrypted so it can't read it.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            In <span className="text-[var(--w360-text)] font-medium">Settings → Your data</span> you can download a
            complete copy of what Women360 holds about you, and permanently delete your account. Deletion takes effect
            immediately and removes your data from the app's database. Your cycle history can also be exported as a
            spreadsheet from the Cycle page.
          </p>
        </Section>

        <Section title="What this is not">
          <p>
            Women360 is a wellness and tracking tool. It is not a medical device, doesn't diagnose anything, and isn't
            a method of birth control. Its estimates and observations come from the information you enter, and are a
            prompt to talk to a clinician, not a replacement for one.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For a copy of your data, a correction, deleting your account, or any question about this page, write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>. You can also download or delete your data yourself in Settings.
          </p>
        </Section>

        <Section title="Still to be confirmed">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>The name of the organisation responsible for the service.</li>
            <li>How long our hosting providers keep backups after an account is deleted.</li>
            <li>The legal basis and any regional requirements for the countries where it will be offered. The terms of use are a draft awaiting legal review.</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
