# IntentMill Draft

## Source

- Ticket key `STEMROBIN-13-math-choice-exercises`; ticket metadata and raw `intent.md` were read.
- `AGENTS.md`, the complete `.prodfarm/charter/`, `.evodocs/modules/module-index.json`, and the math-courseware, learner-experience, domain-services, and database-schema modules were read.
- Inspected code: `.agents/skills/sr-math-lesson/` contracts, exercise checker, and saver; legacy `.agents/skills/sr-lesson/` contract and saver; `app/src/components/quiz-drawer.tsx`; `app/src/lib/quiz.ts`; `app/src/styles/app.css`; `ssot-schemas/db-schemas/stemrobin.sql`; `app/tests/lesson-regeneration.spec.ts`; and `app/src/lib/answer-normalize.test.ts`.
- Read `resources/reference/DESIGN.guide.md` and `resources/reference/DESIGN.md`. The current choice controls already use the prescribed compact, full-width, teal-blue/green interaction pattern and the existing mobile drawer layout.
- No new external SDK, library, API, cloud service, or dependency is required, so no library documentation lookup is needed.
- No database write is performed in this draft phase. The repository runbook and current saver are the DB-operation contract; the locally required `nf-db` skill is not available in this session, so all live mutation remains deferred to cap6's approved saver path.

## Draft Spec

Draft requirement: all current and future math-lesson deck items are `choice` questions with one correct option and at least three options. Existing lesson prompt text and ordinal order are immutable during migration. A question may contain five or more options.

Draft requirement: the saved deck remains the one source of truth for the lesson's embedded practice section, printed PDF, and card drawer. The answer key remains hidden from the initial browser payload.

Draft requirement: all existing math answer events and quiz attempts are removed before replacing question rows. This is confirmed human approval, not a data-retention decision left to implementation.

Draft non-scope: biography chapter questions, their saver, their quiz behavior, and unrelated login inputs remain unchanged.

## Draft Plan

Draft direction:

1. Change the supported math exercise contract and deterministic checker so a complete deck contains only choice items, retains its existing layer/type/review composition, and accepts more than four options.
2. Update the math saver and practice projection to validate/render arbitrary valid choice counts and to clear the approved answer-event and attempt history before replacing math decks.
3. Retire math-only input/work UI and score handling while preserving the shared choice interaction used by biography questions.
4. Add a deterministic backfill utility under the math-generation skill that reads the current math decks, preserves prompt/order/type/layer/review/answer fields, turns each non-choice item into a choice item, and saves complete decks through the existing saver.
5. Run the utility over all current math lessons, then verify database shape, HTML/PDF projection, browser choice interaction, scoring, and pre-answer key secrecy.

## Code And Evodocs Findings

- The math-courseware module confirms that a deck save is a whole-deck replacement and generates the reader-visible practice section plus PDF from the deck. Code agrees with the module documentation.
- Current `sr-math-lesson` deliberately favors typed recall and open `work` responses. The ticket explicitly overrides that pedagogy only for math exercise answer modes; types, layers, review scheduling, prompt text, and explanations remain useful and should stay intact.
- The existing card drawer already presents choice options as a vertical list of full-width buttons, shuffles display order while preserving the stored option index, and sends only a chosen index to the server. This is the existing UI pattern to retain; no new control, route, color, typography, or layout decision is needed. A current 5+ option item is the empirical UI coverage needed for the new allowance.
- A math deck projection affects these learner-visible surfaces: embedded practice in the lesson iframe, printable PDF from the same HTML, the lesson card drawer, attempt scorecards, and resumed attempts. The final scope intentionally changes the first four and clears the last two; it does not affect the story card drawer.
- `getLessonQuestions` omits `correct_index`, `accept`, and `answer`; `recordAnswer` reads the hidden fields only after authentication. This secrecy boundary must not change.
- Current score summaries treat `work` as ungraded and show a separate work count. Once every math item is choice, the math scorecard must treat every item as gradable and must not retain work-specific learner copy.
- `sr_questions` accepts all three answer modes at schema level, while story questions use a separate table. The ticket can enforce choice-only behavior in math generators and runtime without changing the shared schema or story contract.
- Existing saver labels only the first six practice options, although its validation does not cap length. The updated projection must label every supported option rather than silently rendering an undefined label.
- Development test obstacles: the existing unit suite has no direct quiz-service tests; content migration needs a live database and PDF rendering needs Playwright/Chrome; browser verification of an authenticated attempt needs the existing local test-session approach. These are implementation checks, not a quality tradeoff or a request for user access.

## Assumptions

- The ticket's “每一课” means math lessons, because it names the math exercise skill and lesson after-class questions; biography chapter questions are explicitly excluded by the released story.
- Existing answer explanations contain enough authoritative material to derive the correct option during the one-time backfill, while the updated skill will author pedagogically grounded distractors for future lessons.
- Clearing prior math attempts includes deleting both `sr_answer_events` and `sr_quiz_attempts` so no empty or stale scorecard remains.

## Risks

- A simplistic migration could preserve text but produce duplicate options or more than one semantically correct choice. The backfill needs deterministic uniqueness/shape checks and a sampled semantic review before saving.
- Replacing decks before clearing attempts would leave score records that no longer match the question identities. The approved cleanup must occur first.
- Changing math-only score behavior can regress shared quiz code used by story chapters. Tests must retain story choice/work behavior.
- A five-or-more-option question can overflow either the embedded lesson iframe or mobile quiz drawer. Playwright screenshots must cover desktop and mobile.
- The stage-2 outline/ledger mismatch documented in evodocs can cause existing saver validation to reject a backfill. The implementation must prove the supported migration path against current persisted lessons instead of bypassing content persistence rules.

## Grill Required

completed
