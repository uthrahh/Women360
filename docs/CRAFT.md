# Craft standard

How Women360 looks and moves, and the checks that keep it that way. It maps every item in the owner's craft lists (the "implement
everywhere" list, the login, task-complete, unslop and animation lists, and the four skill notes: UX and animation, polish,
unslop, unreasonable craft) to what the app does. **It must stay true**: CLAUDE.md §8 makes it part of the definition of done.

Status words: **Done** (built, with where), **Partly** (built where it applies, and what is left), **N/A** (doesn't fit this
product, and why), **Not built** (needs a decision first). Where a list item came from another product (a flight tracker, a Windows
logo), the idea is applied to Women360 instead of the words being copied.

Automated guards: `npm run check:compliance` (no `transition: all`; the motion tokens stay), `e2e/16-craft.spec.ts` (habit tick,
rolling count, sign-in card, combo box, switch, tab pill, touch targets, layout shift), `e2e/05-accessibility.spec.ts` (axe, light and
dark), `src/lib/*.test.ts`.

## 1. One set of motion numbers (`src/index.css`, `tailwind.config.ts`)

| Token | Value | Used for |
| --- | --- | --- |
| `--ease-enter` | `cubic-bezier(0.32, 0.72, 0, 1)` | anything arriving: fast start, soft landing (never ease-in for an entrance) |
| `--ease-exit` | `cubic-bezier(0.55, 0, 1, 0.45)` | anything leaving |
| `--ease-move` | `cubic-bezier(0.77, 0, 0.175, 1)` | something already on screen moving or resizing (tab pill, rolling digits, chevrons) |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | only the habit tick's fill and the switch knob (physical things with give) |
| `--dur-press` / `--dur-hover` | 120 / 150 ms | press and hover feedback |
| `--dur-popover` | 200 ms | menus, dropdowns, list boxes, dialogs (a toast takes 240) |
| `--dur-exit` | 160 ms | exits: about 20% shorter than the entrance (a toast leaves in 180 after 240) |
| `--dur-sheet` / `--dur-move` | 260 / 320 ms | bottom sheets; things moving in place and page-level moves |

Tailwind names: `ease-enter`, `ease-exit`, `ease-move`, `ease-overshoot`, `duration-press|hover|popover|exit|sheet|move`.
Rules: animate `transform` and `opacity` (colour and shadow are fine); never `transition: all` *(guarded)*; interactive state is a
CSS transition, so it turns round from where it is (keyframes only for one-shots: the sign-in fly-in, the success pulse, the shake);
reduced motion turns every animation and transition off (one rule in `index.css`) and the end states are the same.
Things that happen many times a minute or from the keyboard don't animate (shortcuts, wheel detents, focus moves).

## 2. "Implement everywhere" list

| Item | Status |
| --- | --- |
| Centre, optical centre | Done: buttons pull an icon at either end 2px toward the edge (`Button`); the tick's icons are centred in a grid cell. |
| Tabular numbers | Done: `font-variant-numeric: tabular-nums` on the page and inherited by form controls; rolling digits use equal-width columns. |
| Layout shift | Done and tested: seven screens measured under 0.1 (Core Web Vitals "good") in `e2e/16`; skeletons, a status line that always has its height, reserved space for messages. Not every screen is measured. |
| Tracking | Done: capitals +0.08em, text under 28px untouched, 28 to 47px −0.01em, 48px and up −0.022em (`index.css`; a `tracking-*` class overrides). |
| Kerning | Done: `font-kerning: normal`, ligatures on, optical sizing auto. No hand-kerned pairs. |
| x-height | Partly: the display serif and the body sans never share a line at different sizes, so no correction is applied; `font-size-adjust` is not set. Revisit if they ever do. |
| Optimistic update | Done: habit ticks, quick logs with Undo, hydration, body log (`HabitsPage.tap`, `BodyLogCard`). Final submits (payment-like) are not optimistic; none exist. |
| Touch target | Done and tested: on a touch screen every button, switch, tab and checkbox has an invisible 44px hit zone (`index.css`, add `data-no-hit` to a dense row to turn it off). |
| Lighting | Partly: one light source from above everywhere; the sign-in card's shadows are tinted by its sky. Elsewhere shadows stay neutral and few (CLAUDE.md §2). |
| Origin-aware animation | Done: the notifications panel grows from the bell's corner and leaves the same way, the combo box list from its field's top edge, the log popover from its button; a toast rises into place. Centred dialogs have no origin, so they grow from the middle. |
| OKLCH | Partly: every colour mix and the sky gradients use OKLCH (even steps in lightness). The brand tokens stay hex because their contrast was checked in those values. |
| Widows | Done: `text-wrap: balance` on headings, `pretty` on text. |
| Safe area | Done: `--safe-*` variables, used by fixed bars, toasts and the sign-in layout. |
| Stagger | Done: list entrances 30ms apart, first six only (`.w360-rise`). |
| Line length | Done: running text is capped with `.measure` (68ch) or a `max-w-*` on the container; long-form pages use `max-w-2xl`. |
| Affordance | Done: an empty ring and an outlined button say "press me"; hover turns them pink; a chosen choice shows pressed state and says tapping it again clears it. |
| Combo box | Done: `ComboBox` (the activity picker, 28 options in groups): type to narrow, arrows, Enter, Escape, ARIA combobox. Short lists stay plain selects. |
| Interruptible animation | Done: see §1. |
| Progressive disclosure | Done: "More details" on the cycle log, hints that show once, optional fields collapsed. |
| Shared-element transition | Done where the browser allows: one tab pill glides between tabs through View Transitions (Chrome, Edge, Safari 18); elsewhere it simply moves. |

## 3. Sign-in screens (`features/auth/`)

A flight tracker's login became Women360's: **one title and one main action** (no subtitle on sign-in; the other screens keep a
subtitle only where it says something the title can't); **a sky** behind it (a morning sky with a low sun and slow clouds by day, stars
and a moon by night; decoration only, hidden from assistive technology, off for reduced motion and Senior Mode); **concentric corners**
(card radius 32, padding 20 on a phone and 24 on a larger screen, so inputs and the button take radius 12 or 8, "inner = outer − padding"); **layered shadows in the
sky's colour** (five layers and a hairline ring in the accent, lit by the sky) *(an owner-approved exception to CLAUDE.md §2's quiet-shadow rule)*; the plain
Women360 mark above the title; **a fly-in** (480ms, rises 28px with a soft landing) and, once she is in, the card lifts away (220ms)
and the app opens with a short cross-fade. All five auth screens share this layout. **Not built:** a Windows logo or any
third-party sign-in button: there is no third-party sign-in, and adding one would require Sign in with Apple on iOS (LAUNCH_STANDARD §1).

## 4. Task complete / habit done (`HabitTick`, `RollingNumber`)

Empty ring until done, then the only filled thing on the card (hierarchy: done reads at a glance); optimistic with no spinner (tested with
a slow server); Undo in the toast; press shrinks to 0.95; on release the fill springs past full size and settles; one ring of light
pulses out to confirm; the flame cross-fades to the check with scale and blur; un-ticking is quicker and doesn't overshoot. Counts roll:
only the digits that change move, up when the number grows and down when it shrinks (9 to 0 included), under a soft fade; screen
readers get the plain number. The "0 streak" is gone (nothing is shown until there is something to show). The dashboard's "To do today"
keeps its spring check and rolls its "left today" count. **Personality** is the motion itself; no charming copy (CLAUDE.md copy rules).

## 5. Unslop pass (landing page)

Headline now says what the product does with this product's nouns ("See how your sleep, food, mood and cycle fit together."); the
one italic accent word is gone; the paper-grain overlay is gone (a fixed full-screen layer with no job); the phone illustration shows only
what the app does today (the "Check-up due" row advertised a feature that is switched off, and was replaced by a sleep row); no
filler badges (the badges that remain carry information, such as "Draft"); one accent; one icon set (Lucide); monospace only where it earns its
place (the password's dots turning into letters); no unnecessary embellishment.

## 6. The animation list

| Item | Status |
| --- | --- |
| Ease out for entrances; popovers 150 to 250ms; popovers from 0.95 | Done (§1; popovers, list boxes, notifications, dialogs). |
| Stagger rows by 30ms | Done. |
| Scale buttons to 0.97 on press | Done (`Button`; icon-sized buttons such as the tick use 0.95). |
| Stretch moving knobs by 12% | Done: the switch knob (`ToggleRow`), tested. |
| Use arcs for object movement | N/A: nothing travels between two distant points. Add an arc if something ever does (a card flying to a counter). |
| Pulse to confirm success | Done: the habit tick. |
| Ease in-out for on-screen movement; transition out to the trigger, not the centre | Done (§1, §2). |
| No spring bounce for everyday UI | Done: overshoot only on the tick and the switch knob. |
| Don't tween handheld movement | Done: the wheel pickers and the bottom sheet follow the finger 1:1 and spring on release. |
| Exits about 20% shorter | Done: 200 to 160ms; 240 to 180ms. A dialog's own exit is not animated yet (it unmounts at once). |
| New state in as the old leaves | Done: icons cross-fade, rolling digits, the tab pill. |
| Masks for reveals; cross-fade icons with scale and blur | Done: rolling digits and the wheels fade at the edges by mask; the tick's flame and check cross-fade with scale and blur. |
| Rubber band past drag limits | Done: the wheel pickers. |
| Same layout ID across shared objects | Done as a view-transition name on the tab pill (§2). |

## 7. Chat screen ("Ask Women360")

Built on 2026-11-18 at the owner's request, from the owner's brief. It is the one place in the app that is purple, by the owner's choice,
and it is switched off unless `CHATBOT_ENABLED` and an `ANTHROPIC_API_KEY` are set. Rules that stay true:

- **Screen:** `features/chat/`. A deep purple panel (the same in light and dark), a slow orange-and-lavender WebGL sky behind a veil (`ChatShader`:
  a quarter of the pixels, only while visible, one still frame under reduced motion and in Senior Mode, never `loseContext()`), and suggested prompts
  to tap on the empty screen. Colours are scoped to `.w360-chat` and checked against the panel base (text 14:1, muted 8:1).
- **Steps and citations:** every look-up shows as a step while it runs ("Searching: ...", "Reading ...", "Reading your last 30 days") and tucks into
  "How I got this" afterwards. A link becomes a link only if the server announced the page as one it read (`sources`) or it is a screen of ours
  (`/app/...`); anything else keeps its words and loses the link (`lib/chatMarkdown.ts`, tested). No HTML is ever made from the model's text.
- **Layout before text:** only finished paragraphs are shown, whole, with their words fading in; the one still being written is a placeholder, so
  nothing below jumps. An answer shown again from memory appears at once.
- **Plan:** `- [ ]` lines become tick boxes with a rolling "n of m done"; the last line `>> a | b | c` becomes up to three next-question chips on the
  newest answer only.
- **Privacy:** the conversation lives in the tab's memory (it survives a trip to another screen, and is gone on reload, New chat or sign-out), never in
  storage or on the server. Her logs reach it only through the numbers-only summary, only while the switch is on, and the server enforces that.
  The route is excluded from idempotency receipts (a stored answer would be a stored conversation). Demo accounts cannot use it.
- **Honesty:** "Not medical advice", what is kept and the emergency line are plain text, never a hint. It helps her understand and prepare for a
  doctor; it never diagnoses. Its health brief awaits a clinician (OWNER_CHECKLIST item 13).
- `e2e/17-chat.spec.ts` runs it against the scripted provider (`CHATBOT_PROVIDER=scripted`, refused in production): prompts, steps, citations, ticks,
  follow-ups, sharing, unsafe links, limits, a dropped stream, reduced motion, phone width, axe in light and dark, and switched off.
