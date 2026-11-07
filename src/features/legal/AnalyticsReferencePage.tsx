import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";
import { EVENTS, GA4_NAME_RULE, PREVIEW_PATH, SCROLL_DEPTHS, TRACKED_PATHS, isValidEventName } from "@/lib/analytics/events";
import { MEASUREMENT_ID, analyticsEnabled, browserOptedOut, onAnalyticsEvent, openChoices, type EmittedEvent } from "@/lib/analytics/ga";
import { useConsent } from "@/lib/analytics/useConsent";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="py-8 border-t border-[var(--w360-border)]">
      <h2 id={id} className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-[var(--w360-text-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

const code = "rounded bg-warmgrey-100 dark:bg-white/[0.08] px-1.5 py-0.5 text-[0.9em] text-[var(--w360-text)]";

function examplePayload(name: string, params: { name: string; example: string | number }[]): string {
  const body = Object.fromEntries(params.map((p) => [p.name, p.example]));
  return `gtag("event", "${name}", ${JSON.stringify(body, null, 2)});`;
}

const SAMPLE_CODE = `<Button variant="secondary" size="sm">
  Save changes
</Button>`;

/**
 * A page for reviewing the Google Analytics 4 tracking: what is sent, when, and what is promised never to be sent. It is generated from
 * the same definitions the tracking code uses (lib/analytics/events.ts), and it has a sandbox whose interactions appear in an on-page log.
 * Nothing done on this page is ever sent to Google.
 */
export default function AnalyticsReferencePage() {
  usePageTitle("Analytics reference");
  const consent = useConsent();
  const enabled = analyticsEnabled();
  const optedOut = browserOptedOut();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 max-w-content mx-auto">
        <Link to="/" className="font-display text-xl font-semibold">Women360</Link>
        <ThemeToggle />
      </header>

      <main className="px-6 sm:px-10 pb-24 max-w-3xl mx-auto" id="sample-top">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Analytics reference</h1>
        <p className="mt-4 text-[var(--w360-text-muted)] leading-relaxed max-w-xl">
          Everything Women360 can report to Google Analytics 4, when, and what it is never allowed to include. For review: this page is built from the same
          definitions the tracking uses, so it cannot say something the code does not do.
        </p>

        <Section id="status" title="Status in this build">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="font-medium text-[var(--w360-text)]">Analytics</dt>
            <dd>{enabled ? "On: this build has a Measurement ID." : MEASUREMENT_ID ? "Off for this visit: it began on a page where Google's script is not allowed." : "Off: no Measurement ID in this build, so no banner, no script and no request."}</dd>
            <dt className="font-medium text-[var(--w360-text)]">Measurement ID</dt>
            <dd>{MEASUREMENT_ID ? `${MEASUREMENT_ID.slice(0, 4)}${"•".repeat(Math.max(MEASUREMENT_ID.length - 6, 3))}${MEASUREMENT_ID.slice(-2)}` : "none"}</dd>
            <dt className="font-medium text-[var(--w360-text)]">This browser</dt>
            <dd>{optedOut ? "Sends Do Not Track or Global Privacy Control: treated as a no, and no question is asked." : consent === "granted" ? "Visitor accepted." : consent === "denied" ? "Visitor declined." : "No choice made yet."}</dd>
            <dt className="font-medium text-[var(--w360-text)]">Pages reported</dt>
            <dd>{TRACKED_PATHS.map((p) => <code key={p} className={`${code} mr-1.5`}>{p}</code>)}</dd>
            <dt className="font-medium text-[var(--w360-text)]">Never reported</dt>
            <dd>Sign-in, registration, the whole signed-in app, the coach and administrator areas, and the installed Android app.</dd>
          </dl>
          {enabled && !optedOut && (
            <p>
              <button type="button" onClick={openChoices} className="underline underline-offset-2 text-[var(--w360-text)]">Change the analytics choice</button> (the question appears on a public page).
            </p>
          )}
        </Section>

        <Section id="rules" title="What always holds">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong className="text-[var(--w360-text)]">Asked first.</strong> Google's script is not even downloaded until the visitor accepts. Accept and Decline look the same; declining is remembered and removes any Google cookies.</li>
            <li><strong className="text-[var(--w360-text)]">Public pages only.</strong> Every event is checked against the list above when it happens. On any other page the event is dropped, and Google's own collection is switched off with its opt-out flag.</li>
            <li><strong className="text-[var(--w360-text)]">No content.</strong> Never what was typed, searched or copied (only how long it was), never a query string, never an email address, never anything from a health record.</li>
            <li><strong className="text-[var(--w360-text)]">No advertising.</strong> Google signals and ad personalisation are off, and consent for advertising stays denied.</li>
            <li><strong className="text-[var(--w360-text)]">Respects the browser.</strong> Do Not Track and Global Privacy Control are honoured.</li>
          </ul>
        </Section>

        <Section id="events" title="Events">
          <p>
            Event names follow GA4's rules: lower-case snake_case, starting with a letter, at most 40 characters ({" "}
            <code className={code}>{String(GA4_NAME_RULE)}</code>), not starting with <code className={code}>ga_</code>, <code className={code}>google_</code> or{" "}
            <code className={code}>firebase_</code>, and never a name GA4 already collects (<code className={code}>click</code>, <code className={code}>scroll</code>,{" "}
            <code className={code}>search</code>…). Parameter values are at most 100 characters.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {EVENTS.map((e) => (
              <li key={e.name}><a href={`#event-${e.name}`} className="underline underline-offset-2">{e.name}</a></li>
            ))}
          </ul>
          {EVENTS.map((event) => (
            <article key={event.name} aria-labelledby={`event-${event.name}`} className="mt-4 rounded-lg border border-[var(--w360-border)] p-5">
              <h3 id={`event-${event.name}`} className="font-mono text-lg font-semibold text-[var(--w360-text)]">{event.name}</h3>
              <p className="mt-1 text-xs">{isValidEventName(event.name) ? `Valid GA4 name, ${event.name.length} characters.` : "Invalid name."}</p>
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="font-medium text-[var(--w360-text)]">When</dt>
                  <dd>{event.trigger}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--w360-text)]">How it is picked up</dt>
                  <dd>{event.how}</dd>
                </div>
              </dl>
              <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label={`${event.name} parameters`}>
                <table className="w-full text-sm">
                  <caption className="sr-only">Parameters sent with {event.name}</caption>
                  <thead className="text-left">
                    <tr><th scope="col" className="py-1 pr-4 font-medium text-[var(--w360-text)]">Parameter</th><th scope="col" className="py-1 pr-4 font-medium text-[var(--w360-text)]">Type</th><th scope="col" className="py-1 font-medium text-[var(--w360-text)]">Meaning</th></tr>
                  </thead>
                  <tbody>
                    {event.params.map((p) => (
                      <tr key={p.name} className="border-t border-[var(--w360-border)] align-top">
                        <th scope="row" className="py-1.5 pr-4 text-left font-mono font-normal text-[var(--w360-text)]">{p.name}</th>
                        <td className="py-1.5 pr-4">{p.type}</td>
                        <td className="py-1.5">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <pre className="mt-4 overflow-x-auto rounded bg-warmgrey-100 dark:bg-white/[0.06] p-3 text-xs text-[var(--w360-text)]" tabIndex={0} aria-label={`Example call for ${event.name}`}>
                {examplePayload(event.name, event.params)}
              </pre>
            </article>
          ))}
          <p className="text-sm">
            Scroll depth reports {SCROLL_DEPTHS.join("%, ")}% only, once each per page view, and never for pages that fit on one screen.
          </p>
        </Section>

        <Sandbox />

        <Section id="turn-on" title="Turning it on and checking it">
          <ol className="list-decimal pl-5 flex flex-col gap-2">
            <li>Create a GA4 property and a Web data stream, and copy its Measurement ID (it starts with G-).</li>
            <li>Set <code className={code}>VITE_GA_MEASUREMENT_ID</code> in the Vercel project's environment variables and redeploy. Without it nothing is shown or sent.</li>
            <li>In the stream's settings, switch off Enhanced measurement (Google's own page-view, scroll and outbound-click events), so only the events above are collected and nothing duplicates.</li>
            <li>Open a public page, choose Accept, and watch <strong className="text-[var(--w360-text)]">Admin &gt; DebugView</strong> (or the Realtime report). Each interaction below should appear with its parameters.</li>
            <li>To report on a parameter (for example <code className={code}>link_area</code>), register it under <strong className="text-[var(--w360-text)]">Admin &gt; Custom definitions</strong> as an event-scoped custom dimension; until then it is stored but not available in reports.</li>
          </ol>
          <p>
            To track a new filter or search box, add <code className={code}>data-track-filter="name"</code> or <code className={code}>data-track-search</code>, with an optional{" "}
            <code className={code}>data-track-list="list name"</code>. For a code sample, wrap it in an element with <code className={code}>data-code-sample</code>, and give its copy button{" "}
            <code className={code}>data-copy-code</code>. Nothing else needs changing.
          </p>
        </Section>
      </main>
    </div>
  );
}

/** Things to click, copy, filter, search and scroll, with a log of what each one produced. */
function Sandbox() {
  const [log, setLog] = useState<EmittedEvent[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => onAnalyticsEvent((e) => setLog((l) => [e, ...l].slice(0, 40))), []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(SAMPLE_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: selecting the text and copying it still works and is tracked.
    }
  }

  return (
    <Section id="sandbox" title="Try it">
      <p>
        Use these to see each event appear in the log below. They are never sent: this page ({PREVIEW_PATH}) only shows them. Scroll this page for the depth events.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-medium text-[var(--w360-text)]">Navigation</h3>
          <nav aria-label="Sample navigation" className="mt-2">
            <ul className="flex flex-col gap-1.5 text-sm">
              <li><a href="#sample-top" className="underline underline-offset-2">Back to top (anchor)</a></li>
              <li><a href="https://example.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">example.com (external)</a></li>
              <li><a href="mailto:someone@example.com" className="underline underline-offset-2">Write to us (email)</a></li>
            </ul>
          </nav>
        </div>

        <div>
          <h3 className="font-medium text-[var(--w360-text)]">Filter and search</h3>
          <div className="mt-2 flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              Category
              <select data-track-filter="category" data-track-list="sample-list" className="rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] px-2 py-1.5 text-[var(--w360-text)]">
                <option>All</option>
                <option>Forms</option>
                <option>Navigation</option>
                <option>Feedback</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Search
              <input type="search" data-track-search data-track-list="sample-list" className="rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] px-2 py-1.5 text-[var(--w360-text)]" />
            </label>
          </div>
        </div>
      </div>

      <div data-code-sample className="rounded-lg border border-[var(--w360-border)]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--w360-border)] text-sm">
          <span>Code sample (tsx)</span>
          <button type="button" data-copy-code onClick={copyCode} className="rounded px-2 py-1 text-[var(--w360-text)] underline underline-offset-2">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-3 text-xs text-[var(--w360-text)]" tabIndex={0} aria-label="Sample code"><code className="language-tsx">{SAMPLE_CODE}</code></pre>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-[var(--w360-text)]">Event log</h3>
          <button type="button" onClick={() => setLog([])} className="text-sm underline underline-offset-2">Clear</button>
        </div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--w360-border)]" tabIndex={0} role="region" aria-label="Event log, scrollable">
          <table className="w-full text-xs">
            <caption className="sr-only">Events produced on this page, newest first</caption>
            <thead className="text-left">
              <tr><th scope="col" className="p-2 font-medium text-[var(--w360-text)]">Event</th><th scope="col" className="p-2 font-medium text-[var(--w360-text)]">Parameters</th><th scope="col" className="p-2 font-medium text-[var(--w360-text)]">Sent to Google</th></tr>
            </thead>
            <tbody role="log" aria-live="polite">
              {log.length === 0 ? (
                <tr><td colSpan={3} className="p-3">Nothing yet. Click, copy, filter, search or scroll.</td></tr>
              ) : (
                log.map((e, i) => (
                  <tr key={`${e.time}-${i}`} className="border-t border-[var(--w360-border)] align-top">
                    <th scope="row" className="p-2 text-left font-mono font-normal text-[var(--w360-text)]">{e.name}</th>
                    <td className="p-2 font-mono break-all">{JSON.stringify(e.params)}</td>
                    <td className="p-2">{e.sent ? "Yes" : `No. ${e.reason ?? ""}`}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
