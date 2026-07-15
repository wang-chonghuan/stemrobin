# IntentMill Spec

## Intent

Surface course structure to the learner: show the lesson title and each section's
title (中文名) in both reading modes, and let the 全文速览 (full-text) view also
display the 课后题 (post-lesson exercises) for reading, traditional-textbook style —
without making those 速览 exercises answerable, judged, or progress-affecting.

## Scope

- The math-lesson reading surface (`app/src/routes/_app/lesson/$id`) and its two
  reading components: the card 精读 view (`CardReader`) and the 全文速览 iframe
  (`buildFullTextHtml` via `LessonFrame`), plus their reading data source
  (`app/src/lib/reading.ts`).
- Exposing each card's section name (`content.cards[].name`) through the reading
  payload and rendering it as a section title in both views.
- Rendering the lesson title in both views.
- Rendering the browser-safe 课后题 (`getLessonQuestions`) as a static, read-only
  list inside the 全文速览, after the full text.
- Supporting i18n label + CSS for the new UI, using existing tokens.

## Non-Scope

- Any answering, judging, event recording, attempt creation, or progress change
  from the 全文速览 课后题 (rejected: making them interactive — grill D3/G-3).
- Any change to the practice `QuizDrawer` answering/scoring contract; it is reused
  only as the read source for the 速览 list and otherwise untouched.
- Sourcing the lesson title or section names from the derived `sr_lessons.html`
  cache (rejected — it carries stale generic labels).
- Translating `content.cards[].name` or the lesson title into non-source locales
  (rejected for this ticket — grill D4; a later translation ticket owns it).
- Any DB schema change, new query beyond the existing `getLessonReading` /
  `getLessonQuestions` reads, new dependency, or change outside `app/`.
- The story reading surface, overview, catalog, and login routes.

## Requirements

R1. `getLessonReading` (and its pure `projectCards`) must expose each reading
card's section name from `content.cards[].name`. The browser `ReadingCard` type
gains a `name: string`; the neutral `NeutralCard` type gains `name`. The read-check
KEY projection stays exactly as-is (no KEY added to the payload).

R2. The card 精读 view must display, for the currently shown card, both the lesson
title and that card's section name (中文名). The lesson title is
`getLessonLabel(id, locale)` (already rendered in the card head); the section name
is the current card's `name`.

R3. The 全文速览 view must display, inside its existing sandboxed iframe, in this
order: (a) the lesson title as a top heading; (b) for each card in card order, the
card's section name as a heading immediately before that card's `bodyHtml`, then the
`bodyHtml`; (c) after all sections, the 课后题 as a static list. The lesson title is
`getLessonLabel(id, locale)`, passed into `buildFullTextHtml`.

R4. The 全文速览 课后题 list must show each exercise's prompt and, for choice items,
its options — sourced from the browser-safe `getLessonQuestions` view model
(prompt/options only; never `correct_index`/`accept`/`answer`). Items render as a
static, non-interactive list: no submit control, no option buttons that answer, no
click handler, no server call.

R5. The 全文速览 课后题 must be display-only: viewing them must not answer/judge any
item, must record no `sr_answer_events` / `sr_content_answer_events` /
`sr_practice_attempts` row and no attempt, and must not change 练习 (practice) or
课文 (reading) progress. (grill D3 / seed G-3.)

R6. Formulas (KaTeX `$…$`) in the section headings' sibling content and in the
课后题 prompts/options must render. In the 全文速览 iframe this is achieved by the
lesson `<head>`'s existing `renderMathInElement(document.body,…)` (all appended
static markup is inside `<body>`), reusing the established mechanism; no new KaTeX
wiring is added.

R7. The section-name and title UI must follow `resources/reference/DESIGN.md`:
three-color palette (no new hue), display type for titles, `--sr-*` ink tokens,
compact hierarchy. The card-head section title uses existing tokens; the 全文速览
headings inherit the lesson's own generated stylesheet inside the iframe.

R8. Mobile: at a 375px viewport the lesson page and the 全文速览 (including the
课后题 list with long KaTeX options) must not overflow horizontally.

## Critical Existing Contracts

- **Answer-key secrecy (charter engineering-rules · answer-key boundary).** The
  reading payload and the 速览 课后题 must never carry `correct_index`, `accept`, or
  `answer`. `getLessonReading` structurally projects the read-check KEY out;
  `getLessonQuestions` is already KEY-free. Both must stay so.
- **Server-only DB access.** All reads go through `app/src/lib/db.ts` `sql()`
  server-side; the browser never holds the connection string. New data reaches the
  iframe only via loader/server-fn payloads.
- **Reading-mode isolation (STEMROBIN-28).** 全文速览 records no read-check and does
  not advance 课文 progress; only the card 精读 flow (`recordReadCheck`) does. Adding
  static 课后题 to 速览 must not introduce any recording path.
- **Card read-check flow (STEMROBIN-27).** The card 精读 read-check submit,
  soft-gate progression, and the KaTeX MutationObserver typeset of app-DOM
  prompts/options must keep working; adding a section-title element to the card head
  must not disturb them.
- **Iframe sandbox + height lifecycle.** The 全文速览 iframe keeps its
  `sandbox="allow-scripts allow-same-origin allow-modals"` and the
  `ResizeObserver`/delayed-measure height lifecycle; a taller document (title +
  headings + 课后题) must remeasure correctly.
- **Per-locale availability.** `getLessonReading` returning `null` for an
  under-covered locale overlay (not-readable) is unchanged; adding `name` to the
  projection must not change that gate.
- **`buildFullTextHtml` / `projectCards` are pure, unit-tested, DB-free.** They must
  remain pure so their unit tests hold.

## Confirmed Decisions

- D1: Lesson title in both views = `getLessonLabel(id, locale)` (locale-aware,
  carries `sr_lessons.title`, not the stale html cache). Not the raw
  `sr_lessons.title` column.
- D2: 全文速览 layout = traditional-textbook order (lesson title `<h1>`, per-section
  `name` `<h2>`, then body; 课后题 block last).
- D3: 全文速览 课后题 are display-only (static, non-interactive); the `QuizDrawer`
  stays the sole answering/scoring path.
- D4: Lesson title + section names render in the source language (zh) in all
  locales this ticket; 课后题 text stays locale-aware via `getLessonQuestions`.
  Translating names/title is out of scope (known limit).
- Recommended defaults carried into requirements: card-head section title styled
  with `--sr-*` tokens; 速览 headings semantic `<h1>`/`<h2>` inheriting the lesson
  stylesheet; questions fetched in the loader via existing `getLessonQuestions`
  while the drawer keeps its own fetch; a `课后题`/`Exercises` i18n key; omit an
  empty section heading; keep the KEY-free boundary.

## Compatibility And Regression Constraints

- `projectCards` and `buildFullTextHtml` consumers: the card 精读 iframe (via
  `CardReader`) and the 全文速览 iframe. Both must keep rendering; existing unit
  tests for `projectCards` (order, KEY-free) and `buildFullTextHtml` must still pass
  (extended, not broken).
- `getLessonQuestions` is also consumed by the `QuizDrawer`; adding it to the lesson
  loader must not alter the drawer's own fetch/answer/score behavior. The drawer
  must remain the only place exercises are answered and scored.
- The card 精读 read-check flow, per-locale availability gate, PDF download, nav
  footer, and login gate must not regress.
- No change to the derived `sr_lessons.html` cache, the DB schema, or any content
  saver.

## Open Questions

None.
