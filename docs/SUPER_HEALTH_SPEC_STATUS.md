# Super Health specifications: what Women360 does today

The mentor's three documents (24 November 2026): *Master Product Specification v1*, *30-Day Guided Health Transformation Challenge
Development Specification v1* and *Development Backlog and Launch Tracker v1* (72 tasks, 38 screens, 32 endpoints, 15 QA scenarios).

The challenge specification's own kickoff checklist (§22, Appendix B) says to build one vertical slice first and demonstrate it before
expanding: *register → assess → allocate advisor → publish plan → assign task → complete task → advisor review*. That slice is built,
on top of what Women360 already had. This page says, item by item, what exists, what was left out and why, so the scope can be agreed
before more is built (the specification asks for conflicts to be recorded and approved by the product owner, §20.1 and §21).

## Built (the vertical slice)

| Spec | What Women360 does |
| --- | --- |
| Roles (§3) | Participant = a woman's account; Health Transformation Advisor = the existing **coach** role; platform and content administrator = the existing **administrator** role. Coach and admin accounts still cannot be created through the API. |
| Programme engine (§2, SM-020/021) | Programmes with a configurable length (7 to 365 days), draft / published / retired. Enrolment lifecycle: answering questions → waiting for a coach → plan being prepared → running → final questions → final review → completed (or left). |
| Consent (SM-008, P02/P03) | Joining shows exactly what the coach will see and records when she agreed. Leaving ends the coach's access at once. |
| Assessment (P03/P04, SM-015/016/067) | Versioned starting and final questions (routine, readiness, constraints; no symptoms or history), save a draft and resume, required questions checked, submitted answers locked. |
| Advisor allocation (SM-018/060, QA-03/05) | An administrator assigns or reassigns a coach; the earlier coach loses access; every change is audited with the previous coach. A coach sees only enrolments assigned to them and only while the programme runs; a refused attempt is logged. |
| Task library (SM-023/059, ADM06) | Templates with category, how it is reported (done/amount/a few words), instructions and a safety note; usable only once approved with the reviewer's name; editing sends it back to review; retire. |
| Plan builder and publication (A04, SM-041/046, QA-06) | Coach adds tasks from approved templates or writes one: schedule (every day, chosen weekdays, once), day range, aim. Publishing creates plan version 1 and notifies her. |
| Task changes and versioning (A05, SM-028, QA-11) | Change, pause, resume, stop. A published task is never edited in place after day 1: it ends the day before and a replacement starts that day, with a new plan version and a reason she reads. History is kept. |
| Scheduling (SM-022/025, QA-08) | Due days are computed from each task's schedule, so a retry can never create a duplicate occurrence. Day 1 is the day she first opens her published plan, on her own calendar. |
| Daily tasks (P06/P07, SM-026/029) | Today's tasks, one-tap done (or the aim, for an amount), a reflection, skip with an optional reason, ask for help. She can still report the two days before today. |
| Event history (SM-027, QA-09) | Every report is an append-only event; the same report twice is not a second event; undo is its own event. |
| Help requests (QA-10, A06) | A help request goes to her coach's queue (and caseload count); the reply appears under the task and notifies her. |
| Weekly and final review (J04/J05, A07, SM-044/068, QA-15) | Weekly review notes (shared with her) and a next review date; the final review completes the programme. |
| Progress report (P12/P14, SM-064) | Tasks done of due and active days (labelled as engagement, not health); at the end, her own starting and final answers side by side ("not a medical result"). |
| Notifications (§13, in-app) | In-app notifications for coach assigned, plan published or changed, coach replied, review written, and (to the coach) answers in and help requested. |
| Admin workspace (ADM01/02/05/06 in part) | Administration > Programmes: participants and coach assignment, programmes, task library. |
| Privacy, export, deletion | Her programme data is in her data download and deleted with her account; the privacy page describes it. |
| Tests (SM-069/070, QA-02/03/08/09/11/15) | `server/tests/programmes.test.ts` (19 tests, including cross-account and cross-coach access) and `e2e/20-programme.spec.ts` (the whole journey in three real browser windows). |

## Not built yet, and why

| Spec | Why it isn't built | What it needs |
| --- | --- | --- |
| Phone number + OTP sign-in (P01, SM-005, QA-01) | Needs an SMS provider (cost, DLT registration in India) and changes every sign-in path. Email and password with lockout and optional two-factor already exist. | Owner decision and an SMS provider account. |
| Payments, tiers, coupons (₹99 / ₹999 / ₹4,999; ADM13) | The spec lists price and payment timing as open owner decisions (§21). Women360's launch standard forbids any purchase button without stated price, renewal and cancellation terms, and mobile stores require their own in-app purchase. | Owner decision on price, refunds and gateway. |
| WhatsApp notifications (SM-062, QA-14) | Needs a WhatsApp Business account, approved templates and opt-in wording. In-app notifications and web push exist. | Provider account and templates. |
| Tamil-first interface | The app has no translation layer; adding one touches every screen. | A decision on Tamil-first vs Tamil-supported, and a translator. |
| Family participation in programmes (P02/P11, SM-012/013/014) | Family itself is now built (profiles an adult keeps for a family member from 13, and view-only or view-and-update access between accounts, decided by the owner of the records; SM-012/014 in substance). Assigning programme tasks to a family member is not. | Decide whether family members join a programme as participants or only share tasks. |
| Daily check-ins (P08, SM-034) | Wellbeing already records mood, stress and energy daily; a second daily form would double her work. | Decide whether programme check-ins reuse Wellbeing. |
| Food companion, recipes, swaps, meal plans (P09, SM-030/031/032) | Needs reviewed recipe content with allergen and nutrition sources. | Content and a reviewer. |
| Academy lessons linked to tasks (P10, SM-035/036/037) | Learn exists but is switched off until clinical review; linking lessons to tasks waits for that. | Clinical review of Learn content. |
| AI summaries, plan suggestions, advisor copilot (§12, SM-047 to 055) | The spec says AI must not block the first release. "Ask Women360" exists and is off until keyed; the health advisor now suggests habits from her own logs and, when the AI is on and she agrees to share, AI ideas filtered for unsafe content (SM-051 in spirit). Summaries and a coach copilot are not built. | After the core loop is proven with real coaches. |
| Advisor profile, credentials, support hours, workload report (P05, A09, ADM04, SM-065) | Needs the operational decisions in §21 (response time, caseload, credentials). | Owner and operations lead decisions. |
| Private file storage, evidence uploads (SM-009) | There are no uploads anywhere in the app, by design. | A reason to collect files. |
| Gamification, points, leaderboard (Master spec) | A forgiving, opt-in game mode is now built (points for logging and habits only, levels, daily quests, a run with rest days and freezes, badges; nothing taken away, nothing for weight or calories). No leaderboard, as the spec asks. | Nothing, unless the mentor wants programme tasks to earn more. |

## Points where the specification and Women360's own rules differ

- **Brand.** The documents say *Super Health*; the code, domain and store listings say *Women360*. Nothing was renamed.
- **Advisor vs coach.** The spec's dedicated advisor is implemented as Women360's coach role, with programme access granted by an administrator, separate from the existing log-sharing a woman grants herself.
- **Health content.** The spec (§9) says developers build the delivery tools and do not invent health prescriptions. Accordingly no real programme content ships: the only programme in the code is a sample for the demonstration accounts, marked as not clinically reviewed.
