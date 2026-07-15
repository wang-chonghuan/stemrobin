# IntentMill Handoff

## Actual Changes

All changes are in `app/`; no schema change, no new dependency, no new query.

- `app/src/lib/reading.ts`
  - Added `name: string` to the neutral `NeutralCard` type and the browser
    `ReadingCard` type; `projectCards` now surfaces `name: card.name` (KEY projection
    unchanged).
  - Extended `buildFullTextHtml` to a traditional-textbook 全文速览: new
    `FullTextExtras` (`title`, `questions`, `exercisesLabel`) and a `FullTextQuestion`
    type. It emits, inside `<article class="sr-lesson">`: an `<h1>` lesson title, per
    card an `<h2>` section `name` before its `bodyHtml`, then a static display-only
    课后题 `<section>` (heading + `<ol>` of prompt + choice options). Added an
    `escapeHtml` helper for the plain-text title/name. Existing 3-arg calls still work
    (extras default `{}`).
- `app/src/components/card-reader.tsx`
  - Card 精读 head now shows the current card's section title: wrapped the lesson
    label in `.sr-card-titles` and render `.sr-card-section` = `card.name` (omitted
    when empty). Read-check flow untouched.
- `app/src/routes/_app/lesson.$id.tsx`
  - Loader fetches the KEY-free `getLessonQuestions` when a card tree exists; the
    全文速览 call passes `{ title: label, questions, exercisesLabel: t(locale,
    'read.exercises') }` into `buildFullTextHtml`. The `QuizDrawer` keeps its own
    independent fetch (unchanged).
- `app/src/lib/i18n.ts` — added `read.exercises` (`课后题` / `Exercises`).
- `app/src/styles/app.css` — added `.sr-card-titles` + `.sr-card-section` (teal
  eyebrow under the lesson title), using existing `--sr-*` tokens; no new hue.
- Tests: `app/src/lib/reading.test.ts` (name surfaced) and
  `app/src/lib/reading-fulltext.test.ts` (title/section-order/课后题/no-interactive/
  KEY-free) extended. Ticket Playwright script + screenshots under
  `.intentmill/tickets/STEMROBIN-35-show-titles/tests/`.

## Spec And Plan Alignment

Implementation matches `im-spec.md` and `im-plan.md`; no deviation.

- Spec obligations: R1 (`name` in payload) ✓; R2 (card 精读 shows lesson title +
  section title) ✓; R3 (速览 title + per-section headings + full text) ✓; R4 (速览
  课后题 prompts + options from `getLessonQuestions`) ✓; R5 (display-only: static,
  no answer/judge/record/progress — 0 interactive controls, no POST during 速览) ✓;
  R6 (KaTeX renders via the lesson head's `renderMathInElement`; `.katex ×250` in
  速览) ✓; R7 (DESIGN tokens, no new hue) ✓; R8 (375px, 0px horizontal overflow) ✓.
- Plan obligations: extended `reading.ts` / `card-reader.tsx` / `lesson.$id.tsx`
  along their existing seams; questions fetched in the loader; drawer untouched;
  functions kept pure; verified via unit + build + browser per plan phases 1–7.
- Critical existing contracts preserved: answer-key secrecy (payload + 课后题 are
  KEY-free — `getLessonReading` projects the read-check KEY out, `getLessonQuestions`
  is KEY-free; browser + unit assertions confirm no `correct_index`/`accept`/`answer`
  leaked); reading-mode isolation (no record path added to 速览 — 0 POST observed);
  card read-check flow + KaTeX MutationObserver untouched; iframe sandbox + height
  lifecycle unchanged; per-locale `null` gate unchanged; `projectCards` /
  `buildFullTextHtml` stay pure.
- Non-scope / rejected options absent: no interactive/answerable 课后题 in 速览; no
  practice-drawer contract change; no `sr_lessons.html` cache use for titles; no
  schema change; no title/section-name translation.

## User Review Points

None. The seed grill G-2 (UI) and G-3 (display-only) plus the charter fully settled
the product choices; D1–D4 were adjudicated under full delegation (cap13) and are
reflected in the spec. No new user-facing decision surfaced during development.

## Residual Issues And Future Improvements

- Known limit (D4): under a non-source locale (en) the lesson title and section
  names render in the source language (zh) — `card.name` and `sr_lessons.title` have
  no translation node; the 课后题 text itself is locale-aware via `getLessonQuestions`.
  Translating titles/section names is future translation work, out of scope here.
- The lesson loader now always fetches `getLessonQuestions` when a card tree exists
  (one extra GET), and the `QuizDrawer` still fetches independently on open. This is
  a deliberate small duplication to keep the drawer untouched; a future refactor
  could share one fetch if desired. Not required for this spec.
- Ticket unit tests live in `app/src/lib/*.test.ts` because this repo's vitest only
  scans `app/src` (STEMROBIN-28 pattern); the ticket `tests/` dir holds the browser
  script, screenshots, and `test-results.md`.
