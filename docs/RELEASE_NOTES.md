# Writing release notes

The page is `/release-notes`. Its content is one list in `src/content/releaseNotes.ts`. Add an entry, run `npm test`, and it appears,
grouped under its month, newest first. The tests below fail on an entry that breaks these rules, so the format holds without anyone policing it.

## The format

```ts
{
  date: "2026-11-08",                 // the day it reached people, ISO format
  headline: "Faster first load",      // what changed, under 60 characters, no full stop
  details:
    "Two or three sentences. What is different for her. Why it matters.",
  area: "Speed",                      // optional small label; see the list in releaseNotes.ts
},
```

**Newest first.** Put new entries at the top of the list. Months are created automatically from the dates.

## Writing the entry

1. **Headline: the change, not the work.** "Say why a cycle was unusual", not "Cycle exclusion feature". Start with what she can now do or what is now
   clearer. Sentence case, no full stop, no version numbers.
2. **Details: two or three sentences.** The first says what is different. The second says what that means for her. A third, only if needed, says what to
   know (a limit, where to find it). Under about 450 characters.
3. **Her words, not ours.** No "API", "database", "refactor", "dependency", "bundle", "CSP". The tests reject the common ones. Say "loads faster", not
   "reduced the JavaScript bundle". Say "sign-in is harder to attack", not "added rate limiting".
4. **Only what she can see or feel.** Internal work (tests, tooling, restructuring) does not belong here unless it changes her experience: then describe
   that, not the work.
5. **Never describe something that is not switched on for everyone.** A feature behind a switch, waiting for a clinician's review, or waiting for a key on the
   server is not released yet. Add its entry in the change that turns it on.
6. **Never promise more than it does.** Health features keep their limits: "an estimate", "not a safety system", "not a method of birth control". If the
   in-app wording carries a caution, so does the note.
7. **One change per entry.** Two unrelated changes on the same day are two entries. A fix she would have noticed ("Screens that can't load now say so") is worth an
   entry; a typo is not.
8. **Dates are the day it went live,** not the day the code was written. Use your local day.

## Why this format

- **A month heading, then dated entries** lets a returning reader jump to the month they last visited (the page has a month menu) and read down to where they stopped.
- **A short headline first** means most readers can scan the page and stop at what matters to them; the two or three sentences are for those who stop.
- **A date on every entry**, in a `<time>` element, is machine-readable (search results, feed readers) and read aloud correctly by screen readers.
- **The optional area label** lets a reader looking for "Cycle" spot it without reading everything. Use it when one clearly applies; leave it off otherwise.

## What the tests check

`src/content/releaseNotes.test.ts`: dates are real and not in the future; newest first; headlines 8 to 60 characters with no full stop; two or three
sentences of detail (the first entry, "Women360 begins", is the one exception); no engineering jargon; no duplicates; months group correctly.

## Starting a new month

Nothing to do. The first entry dated in a new month creates its heading. Do not edit or reorder past entries; if something earlier was wrong, add a new entry that
says what changed.
