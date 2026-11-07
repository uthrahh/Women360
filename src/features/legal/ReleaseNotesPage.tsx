import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "@/config/site";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTitle } from "@/hooks/usePageTitle";
import { RELEASE_NOTES, groupByMonth, shortDate } from "@/content/releaseNotes";

const MONTHS = groupByMonth(RELEASE_NOTES);

/**
 * What changed in Women360, newest first and grouped by month. Plain semantic structure: a heading per month, an ordered
 * list of entries under it, and each entry is an article with its date in a <time> element, so it reads well on screen,
 * in a screen reader's heading list, and in a feed reader or a search result.
 */
export default function ReleaseNotesPage() {
  usePageTitle("Release notes");
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 sm:px-10 h-20 max-w-content mx-auto">
        <Link to="/" className="font-display text-xl font-semibold">Women360</Link>
        <ThemeToggle />
      </header>

      <main className="px-6 sm:px-10 pb-24 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Release notes</h1>
        <p className="mt-4 text-[var(--w360-text-muted)] leading-relaxed max-w-xl">
          What has changed in Women360, newest first. Questions or something not working?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>
        </p>

        <nav aria-label="Jump to a month" className="mt-8">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {MONTHS.map((m) => (
              <li key={m.key}>
                <a href={`#month-${m.key}`} className="underline underline-offset-4 decoration-[var(--w360-border)] hover:decoration-current">
                  {m.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {MONTHS.map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`} className="mt-12">
            <h2 id={`month-${month.key}`} className="font-display text-2xl font-semibold pb-3 border-b border-[var(--w360-border)]">
              {month.label}
            </h2>
            <ol>
              {month.entries.map((note) => (
                <li key={`${note.date}-${note.headline}`} className="border-b border-[var(--w360-border)] last:border-b-0">
                  <article className="grid gap-x-8 gap-y-1 py-6 sm:grid-cols-[5.5rem_1fr]" aria-labelledby={`n-${note.date}-${slug(note.headline)}`}>
                    <p className="text-sm text-[var(--w360-text-muted)] tabular-nums sm:pt-1">
                      <time dateTime={note.date}>{shortDate(note.date)}</time>
                    </p>
                    <div>
                      <h3 id={`n-${note.date}-${slug(note.headline)}`} className="text-lg font-semibold leading-snug">
                        {note.headline}
                      </h3>
                      {note.area && <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--w360-text-muted)]">{note.area}</p>}
                      <p className="mt-2 text-[var(--w360-text-muted)] leading-relaxed">{note.details}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </main>
    </div>
  );
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
