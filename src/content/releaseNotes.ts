/**
 * Release notes: what changed in Women360, for the people who use it.
 *
 * Add new entries at the TOP of the list (newest first). The format and the house rules are in docs/RELEASE_NOTES.md and
 * are checked by releaseNotes.test.ts, so a malformed entry fails the tests rather than shipping.
 *
 *   date      ISO day the change reached people ("2026-11-08")
 *   headline  what changed, in plain words, under 60 characters, no full stop
 *   details   two or three sentences: what is different for her, and why it matters
 *   area      optional: the part of the app it touches (shown as a small label)
 *
 * Only write about changes she can see or feel. Leave out anything not switched on for everyone yet, and never describe
 * a health feature as more than it is.
 */
export interface ReleaseNote {
  date: string;
  headline: string;
  details: string;
  area?: "Account" | "Cycle" | "Activity" | "Nutrition" | "Sleep" | "Health" | "Habits" | "Privacy" | "Design" | "Speed" | "Reliability" | "Reports";
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: "2026-11-08",
    headline: "Quicker, calmer taps and a jump-anywhere menu",
    details:
      "Ticking a habit now responds the instant you tap, with an Undo if it was a slip, and screens you have just visited show their last view while fresh data loads. Press Ctrl+K (or ?) to jump to any screen or action, and G then a letter to go straight to one. Sheets on a phone can be pulled down to dismiss, and the Back button closes them instead of leaving the screen.",
    area: "Design",
  },
  {
    date: "2026-11-08",
    headline: "Clearer messages, tabs and dialogs",
    details:
      "Error messages now stay long enough to read, and the same message no longer stacks up. Tabs work with the arrow keys, fade at the edge when more are hidden on a phone, and remember which one you were on after a reload. Dialogs keep the keyboard inside them, and a skip link lets you jump straight to the page.",
    area: "Design",
  },
  {
    date: "2026-11-08",
    headline: "Faster first load",
    details:
      "Women360 now downloads far less before it appears, so the first visit is quicker and later visits reuse what is already on your device. The fonts are served from Women360 itself, so no font provider sees your visit. The report PDF tool loads only when you open a report.",
    area: "Speed",
  },
  {
    date: "2026-11-05",
    headline: "Anonymous counts of which screens are used",
    details:
      "Women360 now keeps simple counts of how often each screen is opened, so we can see what is useful. A count never says who: it holds no name, email or account number, and browsers that ask not to be tracked are not counted. The privacy page describes exactly what is kept.",
    area: "Privacy",
  },
  {
    date: "2026-11-05",
    headline: "A notice while the service wakes up",
    details:
      "The service rests when nobody is using it, so the first sign-in of the day can take up to half a minute. You now see a message saying so, instead of a page that looks stuck.",
    area: "Reliability",
  },
  {
    date: "2026-11-05",
    headline: "Screens that can't load now say so",
    details:
      "If something fails to load, the screen tells you and offers Try again, instead of waiting forever. A temporary server problem no longer signs you out; only an expired session does.",
    area: "Reliability",
  },
  {
    date: "2026-10-29",
    headline: "A calmer home screen",
    details:
      "Today now shows a greeting, your to-do list, quick ways to log, and a short summary of the day. The cycle card appears only while you are on your period, or around ovulation if you choose that in Cycle settings. Sleep now asks for both the day and the time you went to bed and woke up, so nights that cross midnight are recorded correctly.",
    area: "Design",
  },
  {
    date: "2026-10-29",
    headline: "Instructions show once, then step back",
    details:
      "Explanations of how a screen works now appear the first time you meet them, and again whenever you press the Help button. Warnings and privacy promises always stay visible.",
    area: "Design",
  },
  {
    date: "2026-10-28",
    headline: "Pick an activity, see an estimate of calories",
    details:
      "Activities now come from a list, each with its own effort levels. Calories are estimated from the weight you last logged and are labelled as an estimate; with no weight logged, no figure is shown. Habits can be linked to an activity, and appear as today's to-do on the Activity page.",
    area: "Activity",
  },
  {
    date: "2026-10-24",
    headline: "Privacy summary and terms of use",
    details:
      "There is now a plain-language privacy page that says what Women360 keeps and who can see it, and a draft of the terms of use. Both are marked as working drafts, and both list what is still to be confirmed.",
    area: "Privacy",
  },
  {
    date: "2026-10-22",
    headline: "Coach and administrator areas",
    details:
      "You can share a summary of your sleep, activity, goals and wellbeing with a wellness coach of your choice, and stop sharing at any time in Settings. Coaches see only that summary, and administrators have their own tools for accounts and feedback. You can also record contraception or pregnancy status for yourself; it is never used to predict or advise.",
    area: "Account",
  },
  {
    date: "2026-10-21",
    headline: "Fewer taps for activity, habits and goals",
    details:
      "Activity has a one-tap quick log and shortcuts you can customise, and entries can be edited afterwards. Habits and goals got the same treatment, so the things you do every day take fewer taps.",
    area: "Activity",
  },
  {
    date: "2026-10-20",
    headline: "Habits and goals are now separate",
    details:
      "A habit is a routine you repeat, ticked off in one tap with a streak that has no guilt attached. A goal has a finish line, and its progress is worked out from your own numbers. Existing goals carried over unchanged.",
    area: "Habits",
  },
  {
    date: "2026-10-20",
    headline: "Step-by-step setup",
    details:
      "Setting up your account is now a short series of steps, and every question it asks is saved. Questions with nowhere to be stored were removed.",
    area: "Account",
  },
  {
    date: "2026-10-19",
    headline: "Download or delete everything we hold",
    details:
      "In Settings, under Your data, you can download a complete copy of what Women360 holds about you. You can also permanently delete your account, which removes your data straight away.",
    area: "Privacy",
  },
  {
    date: "2026-10-18",
    headline: "Stronger sign-in security",
    details:
      "Passwords now need at least 12 characters and can't be common or built from your name or email. Repeated wrong attempts pause sign-in for 15 minutes, and changing your password or choosing Sign out everywhere ends other sessions immediately.",
    area: "Account",
  },
  {
    date: "2026-10-18",
    headline: "Light and dark mode",
    details:
      "Choose light, dark, or follow your device, from the toggle on the landing and sign-in pages or in Settings. Dark mode is designed as its own palette, not an inverted copy.",
    area: "Design",
  },
  {
    date: "2026-10-18",
    headline: "Send feedback from Settings",
    details:
      "You can now rate Women360 and leave a comment without leaving the app. Feedback is read by the people who run the service and is deleted if you delete your account.",
    area: "Account",
  },
  {
    date: "2026-10-12",
    headline: "A calmer, redesigned app",
    details:
      "The menu, the Today screen and the way lists move were redesigned to feel quieter and easier to scan. Senior Mode, with its larger text and simpler tiles, keeps working throughout.",
    area: "Design",
  },
  {
    date: "2026-10-12",
    headline: "Say why a cycle was unusual",
    details:
      "You can now mark a cycle as unusual and note why, and it is left out of your predictions so one odd month doesn't skew the next. Each prediction explains how it was worked out, and you can export your cycle history as a spreadsheet.",
    area: "Cycle",
  },
  {
    date: "2026-10-01",
    headline: "One-tap period start and a colour-coded calendar",
    details:
      "Log that your period started today with a single tap, and undo it with a second. The calendar shades each day by phase, and adding past periods now works as it should.",
    area: "Cycle",
  },
  {
    date: "2026-09-29",
    headline: "Cycle predictions based on your own cycles",
    details:
      "Predictions now come from your own recent cycle lengths and are shown as a range with a confidence level, rather than assuming everyone has a 28-day cycle. A clear notice says the fertile-window estimate is not a method of birth control.",
    area: "Cycle",
  },
  {
    date: "2026-09-27",
    headline: "Medicine doses, taken or skipped",
    details:
      "Add the times you take a medicine and record each dose as taken or skipped, with a rolling adherence figure. It is a convenience for keeping track, not a safety system, so please don't rely on it alone.",
    area: "Health",
  },
  {
    date: "2026-09-27",
    headline: "Log a meal again in one tap",
    details:
      "Meals you have logged before appear as chips, so repeating them takes a tap instead of retyping everything. Totals are shown without calorie targets or colour-coded judgement.",
    area: "Nutrition",
  },
  {
    date: "2026-09-27",
    headline: "Ready-made activity routines",
    details:
      "Activity now has a small library of guided routines you can start from. During your period it can suggest a lighter one, and you can dismiss that suggestion if you'd rather not see it.",
    area: "Activity",
  },
  {
    date: "2026-09-09",
    headline: "Health reports as a PDF, and a clearer sleep rating",
    details:
      "Reports are now a real, branded PDF for the last 7, 30 or 90 days, with a plain note where nothing was logged. Sleep quality is a 1 to 5 rating, and nutrition accepts one decimal place.",
    area: "Reports",
  },
  {
    date: "2026-09-08",
    headline: "Everything you log is now saved to your account",
    details:
      "Nutrition, Sleep, Cycle and Goals can be added, edited and deleted, and what you record stays with your account instead of disappearing when you leave. Deleting always asks first.",
    area: "Account",
  },
  {
    date: "2026-08-19",
    headline: "Women360 begins",
    details:
      "The first version of the app's screens: Today, Cycle, Nutrition, Activity, Sleep, Wellbeing, Goals and Health. It was a prototype to design the experience before connecting it to real storage.",
  },
];

export interface ReleaseMonth {
  /** "2026-11" */
  key: string;
  /** "November 2026" */
  label: string;
  entries: ReleaseNote[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Entries grouped by month, newest month first and newest entry first within it (entries are already newest first). */
export function groupByMonth(notes: ReleaseNote[] = RELEASE_NOTES): ReleaseMonth[] {
  const months: ReleaseMonth[] = [];
  for (const note of notes) {
    const key = note.date.slice(0, 7);
    let month = months.find((m) => m.key === key);
    if (!month) {
      month = { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, entries: [] };
      months.push(month);
    }
    month.entries.push(note);
  }
  return months;
}

/** "8 Nov" for the list; the machine-readable date goes in the <time> element. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}
