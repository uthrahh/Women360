import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/config/site";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";
import { analyticsEnabled } from "@/lib/analytics/ga";
import { useFeatures } from "@/context/FeaturesContext";

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
  // The chat is described only while it is switched on: this page never describes something that is off.
  const { chatbot } = useFeatures();
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
            <span className="text-[var(--w360-text)] font-medium">Your account:</span> name, email, date of birth (Women360 is for adults, so it is checked when you sign up), whether and when you
            confirmed your email address, and a one-way hash of your password. We can't read your password.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">What you log:</span> cycle, meals and hydration,
            caffeine and alcoholic drinks and bowel movements, activity, sleep, mood and wellbeing (stress, energy and a note
            only if you add them), goals and check-ins, medicines and doses, appointments, measurements,
            your emergency contact, contraception and pregnancy status if you choose to record them, notes a coach writes about you, and any feedback you send.
            On a cycle day you may also record pads or tampons used, cervical mucus, waking temperature and sex. Those are
            kept for your own record only: Women360 does not use them to predict anything, and they are never part of what a coach sees.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">Reminder devices:</span> only if you turn on reminders
            for when Women360 is closed. For each device we keep the address your browser gives us for it, the keys that
            let us send to it, and your time zone. We use them only to send the reminders you set, and the notification
            doesn't say what a reminder is for. You can turn it off per device under Settings, Reminders, and it is
            removed if you delete your account.
          </p>
          <p>
            <span className="text-[var(--w360-text)] font-medium">Steps from your phone or a file:</span> only if you ask for it. In the Android app you can let Women360 read your daily step
            totals from Health Connect (the permission is to read steps and nothing else: Women360 never writes to it), or you can import a file from the Apple Health app or a spreadsheet.
            We keep one number for each day, and that it came from a phone or a file, with the time it was filled in. A file is read in your browser and the rest of it is never sent. A day you entered
            yourself is never changed by a sync. You can stop at any time by removing the permission in Health Connect, and the steps stay with your other logs until you delete them or your account.
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

        {chatbot && (
          <Section title="The AI chat">
            <p>
              <span className="text-[var(--w360-text)] font-medium">What it is:</span> "Ask Women360" answers your questions with an AI model from Anthropic. It can be wrong and it is not medical advice.
              It is for signed-in accounts only, never the shared demonstration accounts.
            </p>
            <p>
              <span className="text-[var(--w360-text)] font-medium">What is sent:</span> the questions you type and the earlier messages of that conversation, so it can follow it, and today's date.
              To answer, it may search the web and read web pages, using search words it writes from your question, so leave your name and other details out of what you ask.
            </p>
            <p>
              <span className="text-[var(--w360-text)] font-medium">Your logs, only if you say yes:</span> the switch at the top of the chat is off until you turn it on. When it is on, the chat can ask
              for a summary of your last 30 days made of averages and counts (sleep, mood, energy, stress, activity, water, cycle phase, how many habits you ticked) and your age range. It never receives your name, email, date of birth,
              medicines, allergies, notes, symptoms you typed, habit names, messages or contraception and pregnancy records. Turn the switch off and the next question is answered without it.
            </p>
            <p>
              <span className="text-[var(--w360-text)] font-medium">What we keep:</span> not your questions and not its answers. The conversation lives in your browser tab and is gone when you close it or press New chat.
              We keep only the time of each question for 2 days, so we can apply the limits on how much one person and the whole site can ask, and when you turned the switch on. Both are in your data download and are erased with your account.
            </p>
          </Section>
        )}

        <Section title="How long it is kept">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Your account and everything you log: until you delete it. You can delete your whole account, or only your cycle and reproductive history, in Settings at any time.</li>
            <li>Security records (sign-in successes and failures): 90 days.</li>
            <li>Save receipts: 24 hours.</li>
            {chatbot && <li>The time of each AI chat question (never its words): 2 days.</li>}
            <li>Sign-in sessions, password-reset links and email-confirmation links: deleted 7 days after they expire, are used or are signed out.</li>
            <li>Records of reminders already sent: 3 days. A reminder device: until you turn reminders off on it, the browser reports it gone, or you delete your account.</li>
            <li>The anonymous usage counts: about 13 months. The one-way codes used to count different people are deleted at the end of each day.</li>
          </ul>
        </Section>

        <Section title="How it is protected">
          <p>
            Everything travels over an encrypted connection (HTTPS, which browsers are told to always use). Passwords are stored only as an
            Argon2id hash, two-factor secrets are encrypted, and the links in our emails work once and expire. Only you can reach your
            records through the app: every request is checked against your account, and the database's automatic public interface is switched off for every table, so records can be reached only through
            the Women360 server. Sign-in is protected against guessing with limits per account and per network.
          </p>
          <p>
            We don't send marketing or promotional messages. The only emails Women360 sends are the ones you trigger: confirming your
            address and resetting your password.
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
            Women360 doesn't sell your data and doesn't show advertising. Your sign-in is kept in your browser's own storage on your device, along with a few settings for this device only (light or dark, sounds on or off, which tips you have seen) and, if the date of birth given at sign-up meant an account couldn't be created, a note of that. None of these settings are sent to us.
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
            Supabase.{chatbot && " If you use the AI chat, your questions are processed by Anthropic."} The fonts are served from Women360 itself, so no font provider sees your visit. If you turn on reminders for when Women360 is closed, they travel through your browser's own notification service (Google for Chrome, Mozilla for Firefox, Apple for Safari). It sees that a notification was sent to your device, but the message is encrypted so it can't read it.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            In <span className="text-[var(--w360-text)] font-medium">Settings → Your data</span> you can download a
            complete copy of what Women360 holds about you, and permanently delete your account. Deletion takes effect
            immediately and removes your data from the app's database. You can also delete only your cycle and
            reproductive history (cycle days and their details, cycle settings, contraception and pregnancy record and the
            conditions you told us about) and keep the rest of your account. Your cycle history can also be exported as a
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
            Women360 is run by Pavithra Uthrah R K. The address below is the contact for everything on this page.
          </p>
          <p>
            For a copy of your data, a correction, deleting your account, or any question about this page, write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>. You can also download or delete your data yourself in Settings.
          </p>
        </Section>

        <Section title="Still to be confirmed">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>How long our hosting providers keep backups after an account is deleted.</li>
            <li>How a legal request for someone's data (for example from a court or the police) would be handled and answered.</li>
            <li>How a data breach would be reported to you and to the authorities (a procedure exists; the regulator and timelines depend on the country, which is not settled yet).</li>
            {chatbot && <li>Anthropic's data-processing terms and how long it keeps what the AI chat sends it (to be confirmed before the chat is turned on for the public).</li>}
            <li>The legal basis and any regional requirements for the countries where it will be offered. The terms of use are a draft awaiting legal review.</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
