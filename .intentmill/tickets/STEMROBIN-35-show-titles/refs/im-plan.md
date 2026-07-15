# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. `im-draft.md` and `im-grill.md` are
background provenance; all material requirements, contracts, decisions (D1–D4), and
constraints are already promoted into `im-spec.md`. Cap6 must not need to reread them.

## Implementation Approach

All changes are in `app/`. The work extends three existing pieces along their
established seams; it adds no new module, query, or dependency.

1. **Reading payload — `app/src/lib/reading.ts`** (spec R1):
   - Add `name: string` to `NeutralCard` and to the browser `ReadingCard` type.
   - In `projectCards`, set `name: card.name` on each projected card. Leave
     `bodyHtml`, `readChecks`, and the KEY projection untouched (answer-key secrecy).
   - `getLessonReading` already selects `l.content`; `content.cards[].name` is
     already present, so no SQL change is required. The per-locale `null` gate is
     unchanged.

2. **Card 精读 section title — `app/src/components/card-reader.tsx`** (spec R2):
   - In `sr-card-head`, render the current card's `card.name` as a section-title
     element alongside the existing lesson label (`sr-card-lesson` =
     `getLessonLabel`) and the `num/total` progress. If `card.name` is empty, render
     nothing for it (no blank heading).
   - Do not change the read-check submit, the soft-gate `passed`/`next` logic, or
     the KaTeX MutationObserver effect.

3. **全文速览 title + section headings + 课后题** (spec R3, R4, R5, R6):
   - Extend `buildFullTextHtml` (keep it pure/DB-free) to accept the lesson title
     and the browser-safe questions and emit, inside `<article class="sr-lesson">`:
     `<h1>` title; then per card an `<h2>` of `name` (omit if empty) followed by the
     card's `bodyHtml`; then a trailing 课后题 block — a heading (i18n label) and an
     ordered list where each item shows the prompt and, for `answerMode === 'choice'`,
     its options as plain list text. No buttons, inputs, submit, or handlers.
   - In `app/src/routes/_app/lesson/$id.tsx`: fetch questions in the loader via the
     existing `getLessonQuestions({ data: params.id })`, and pass them plus
     `getLessonLabel(id, locale)` into `buildFullTextHtml` at the 全文速览 call site.
     The `QuizDrawer` keeps its own independent `getLessonQuestions` fetch.
   - Formulas render via the lesson head's existing
     `renderMathInElement(document.body,…)`; the appended 课后题 markup is inside
     `<body>`, so no extra KaTeX wiring is added.

4. **i18n + CSS** (spec R7):
   - Add a `课后题` / `Exercises` label key in `app/src/lib/i18n.ts` following the
     existing key structure and Chinese-source tone.
   - Add a compact `.sr-card-section` (or equivalent) rule in
     `app/src/styles/app.css` for the card-head section title, using existing
     `--sr-ink*` tokens and display type — no new hue or spacing scale. 全文速览
     `<h1>`/`<h2>` inherit the lesson's generated stylesheet inside the iframe;
     add app-side CSS only if the 课后题 list needs minimal structural styling that
     the lesson stylesheet does not already provide.

## Implementation Drift Controls

- **Answer-key secrecy cannot be bypassed.** The 速览 课后题 must come only from the
  `getLessonQuestions` view model; never read or pass `sr_questions.correct_index`,
  `accept`, or `answer`. The reading payload must not gain any read-check KEY field.
- **Display-only is structural, not conventional (D3/R5).** The 课后题 must be static
  markup with zero interactive controls and zero server calls. Do not reuse the
  `QuizDrawer` component, `recordAnswer`, `recordReadCheck`, `startAttempt`,
  `endAttempt`, or `recordPracticeAttempt` in the 速览 path. Verify at runtime that
  no answer/attempt/progress request fires when viewing 速览.
- **Do not modify the practice drawer contract.** `QuizDrawer` and its
  fetch/answer/score wiring stay as-is; it remains the only answering/scoring path.
- **Lesson title source is fixed (D1).** Use `getLessonLabel(id, locale)`; do not
  introduce `sr_lessons.title` as a second UI title source and do not read the
  `html` cache for titles/section names.
- **Do not translate names/title (D4).** Render `card.name` and the title in the
  source language; do not add overlay/translation logic for them.
- **Keep purity.** `projectCards` and `buildFullTextHtml` stay pure and DB-free so
  their unit tests remain valid; new signature params are plain data.
- **Preserve reading-mode isolation and the iframe height lifecycle.** No recording
  path in 速览; the taller document must remeasure via the existing lifecycle.
- Any implementation-time surprise (e.g. a lesson whose head does not auto-render
  KaTeX, or a card missing `name`) is handled by fail-fast/omission and recorded in
  `im-handoff.md`, not by a silent fallback that hides a broken contract.

## Phases

1. **Reading payload + unit test.** Add `name` to the types and `projectCards`
   (spec R1). Extend the existing `projectCards` unit test to assert `name` is
   projected and that no KEY field appears. Verify: `cd app && npm run test`.
   Regression note: consumers are `CardReader` and the 全文速览 builder — both
   covered below; no other consumer of `projectCards`.

2. **`buildFullTextHtml` extension + unit test.** Add title + per-section headings +
   the static 课后题 block (spec R3–R5). Add unit tests asserting: the title appears;
   each card `name` appears as a heading in card order before its body; each
   question prompt and choice options appear; and the emitted HTML contains no
   interactive markup (no `<button`, `<input`, `<form`, `onclick`, `sr-quiz-opt`).
   Verify: `cd app && npm run test`. Regression: the existing `buildFullTextHtml`
   test must still pass (title/headings are additive).

3. **Card 精读 section title.** Render `card.name` in `sr-card-head` (spec R2) with
   `.sr-card-section` styling. Verify in the browser that the section title changes
   as the learner moves between cards and the read-check flow still works.

4. **Loader wiring + 全文速览 call site.** Fetch `getLessonQuestions` in the loader
   and pass questions + `getLessonLabel(id, locale)` into `buildFullTextHtml` (spec
   R3/R4). Regression: confirm the `QuizDrawer` still fetches and answers/scores
   independently (its wiring is unchanged).

5. **i18n + CSS.** Add the `课后题`/`Exercises` key and the card-section CSS (spec
   R7). Verify no new hue/token is introduced (DESIGN.md).

6. **Browser verification (gate6 empirical).** Per
   `references/capability-6-dev-unit-test/playwright-browser-verification.md`:
   standalone Playwright from `app/node_modules/playwright`; mint a `sr_session`
   cookie for the dedicated test learner (user 2) using `SESSION_SECRET`
   (dev fallback `stemrobin-dev-session-secret`), no password typed; start
   `cd app && npm run dev`; open `math-s3-07`. Assert: card 精读 shows the section
   title (e.g. `为什么学这个`) + lesson title (`去分母解方程`); switch to 全文速览 and
   assert the lesson title + section headings (e.g. `讲解`, `例题`) + the 课后题 list
   (prompts + options) are visible; assert the 速览 课后题 are not answerable and
   that no practice/answer/attempt/progress request fires when viewing 速览 (network
   assertion); confirm formulas render; check a 375px viewport has no horizontal
   overflow. Capture screenshots (card view + 速览, desktop + mobile).

7. **Build + full unit suite.** `cd app && npm run test` and `cd app && npm run
   build` must be clean.

## Unit Test Plan

Ticket-scoped tests live under `.intentmill/tickets/STEMROBIN-35-show-titles/tests`
(mirroring the existing app unit-test setup / `app/vitest.config.ts`). Reuse or
extend the existing `reading.ts` unit tests.

High-risk assertions (not happy-path only):

- **R1 payload:** `projectCards` sets `name` from `content.cards[].name` and the
  projected `ReadingCard`/read-check objects contain no `correct_index`/`accept`/
  `key`/`answer` (answer-key secrecy).
- **R3/R4 layout:** `buildFullTextHtml` output contains the lesson title, each
  card's `name` as a heading in card order, and each question's prompt + choice
  options.
- **R5 display-only (structural):** `buildFullTextHtml` output contains no
  interactive markup — assert absence of `<button`, `<input`, `<form`, `onclick=`,
  and the `sr-quiz-opt` class in the 课后题 block. This is the unit-level guard for
  "not answerable"; the runtime no-record guarantee is verified in phase 6.
- **Regression:** existing `projectCards` order/KEY-free test and the existing
  `buildFullTextHtml` test still pass after the signature/output changes.

Runtime-only high-risk behavior that cannot be unit-tested (documented for phase 6
browser verification): the no-answer/no-record/no-progress guarantee for 速览
课后题 (network assertion), KaTeX rendering in the iframe, the section title updating
per card, and 375px no-overflow.

## Handoff Expectations

After development, cap6 writes `im refs path/im-handoff.md` summarising the actual
changes at file granularity (`reading.ts`, `card-reader.tsx`, `lesson.$id.tsx`,
`i18n.ts`, `app.css`, tests), whether the implementation matches `im-spec.md` /
`im-plan.md` and why for any deviation, any missed user-review points that should
have been grilled, and residual issues / future improvements (notably the D4 known
limit: source-language section names/title under non-source locales). It records the
browser evidence (titles shown in card + 速览, 课后题 listed and not answerable, no
record event from 速览, formulas render, 375px no overflow) with screenshot paths,
plus `npm run test` and `npm run build` results. If an external premise fails, cap6
records it under `## Blocker` and stops without running gate6. Do not return to cap4.
