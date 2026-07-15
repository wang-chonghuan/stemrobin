# IntentMill Grill

> Adjudicated under full delegation (n-prodfarm cap13, no human) from `.prodfarm/charter/`
> + the batch 0006 seed grill decisions G-2 (UI) and G-3 (速览 课后题 display-only),
> which the ticket intent already carries. Each blocking decision's `final_decision`
> is the charter/seed-grounded ruling.

## Blocking Decisions

1.
- id: D1-lesson-title-source
- question: Which source renders the "lesson title" the intent asks for in both views — the raw `sr_lessons.title` column, or the existing locale-aware `getLessonLabel(id, locale)` (which is derived from that title)?
- recommendation: Use `getLessonLabel(id, locale)`. It is the established locale-aware title renderer already shown in the card head and nav footer (`app/src/lib/curriculum.ts`), carries `sr_lessons.title` verbatim for the source locale (verified: `math-s3-07` → `3.7 去分母解方程`), and is NOT the stale `html` cache the constraint forbids. Using it keeps one title source across both views and stays locale-correct; raw `sr_lessons.title` would be a second, zh-only source.
- final_decision: Use `getLessonLabel(id, locale)` as the displayed lesson title in the card 精读 head (already present) and pass it into `buildFullTextHtml` for the 全文速览 top heading. This satisfies the intent's binding constraint ("render the real title, not the stale html cache") via one SSOT-consistent, locale-aware source (engineering-rules §5 SSOT).

2.
- id: D2-fulltext-layout
- question: How are the lesson title, section titles, and 课后题 laid out in 全文速览?
- recommendation: Traditional-textbook order (seed grill G-2, matching Chinese 义务教育 textbook layout and Khan-style article/practice separation): lesson `<h1>` at top, each section's `name` as an `<h2>` heading before its `bodyHtml`, then the 课后题 as a trailing static block (heading + ordered prompt/options). Emit inside `<article class="sr-lesson">` so the lesson's own stylesheet (already in `head`) styles it and the head's `renderMathInElement(document.body,…)` typesets it.
- final_decision: Adopt the recommended traditional-textbook order (G-2). Section titles come from `content.cards[].name`; the 课后题 come from the browser-safe `getLessonQuestions` (KEY-free). No lesson `<h1>`/`<h2>` currently exists in the JSONB-derived full text, so this is additive.

3.
- id: D3-fulltext-exercises-readonly
- question: In 全文速览, are the 课后题 answerable/judged, and do they affect practice or 课文 progress?
- recommendation: No — display only (seed grill G-3). Render as static HTML with no submit control, no click handler, and no server call, so there is structurally no path to `recordAnswer`/`recordReadCheck`/`recordPracticeAttempt` or any attempt row. The real answering/scoring stays the `QuizDrawer` practice flow (unchanged). Options render as a plain list, not `sr-quiz-opt` buttons, so they read as review-only and stay visually distinct from the graded drawer.
- final_decision: Display-only per G-3. Static, non-interactive 课后题 in 速览; no answer/judge/record/progress. The practice drawer remains the sole answering/scoring path.

4.
- id: D4-nonsource-locale-title-and-section-language
- question: Under a non-source locale (en), what language do the lesson title and section titles (`card.name`) appear in?
- recommendation: Source language (zh) for the lesson title and section names, because STEMROBIN-34 restored only the zh `name`s and no translation node exists for them, while the 课后题 prompt/option TEXT stays locale-aware via `getLessonQuestions`. zh is the default and primary learning locale (`locale.server.ts` default), so this is low product risk; translating titles/section names is separate translation work, not this display ticket.
- final_decision: Lesson title + section names render in the source language (zh) in all locales this ticket; 课后题 text remains locale-aware. Translating `card.name`/title into non-source locales is out of scope (see Out-of-Scope Guardrails) and recorded as a known limit.

## Recommended Defaults

- Card 精读 section title: add a compact `.sr-card-section` element in `sr-card-head` (`app/src/components/card-reader.tsx` + `app/src/styles/app.css`) using existing `--sr-ink`/`--sr-ink-soft`/`--sr-ink-dim` tokens and display type — no new hue or spacing scale (DESIGN.md).
- 全文速览 headings use semantic `<h1>`/`<h2>` inside `.sr-lesson` and inherit the generated lesson stylesheet (already DESIGN-aligned); no per-element inline theming beyond minimal structure.
- Questions for 速览 are fetched in the lesson route loader via the existing `getLessonQuestions` and passed into `buildFullTextHtml`; the `QuizDrawer` keeps its own independent fetch so the practice path is untouched (constraint: don't break the drawer).
- `课后题`/`Exercises` block heading added as an i18n key in `app/src/lib/i18n.ts` (Chinese source per DESIGN content tone).
- If a card ever has an empty/missing `name`, omit its heading rather than render a blank one.
- Keep the KEY-free boundary: never read `sr_questions.correct_index`/`accept`/`answer` into the 速览 iframe; only the `getLessonQuestions` view model.
- R-TEST (login gate): the browser assertions need a logged-in learner, but no new test account/credential is required — reuse the existing dedicated test learner (user 2) and mint a `sr_session` cookie with `SESSION_SECRET` (dev fallback `stemrobin-dev-session-secret`) via standalone Playwright from `app/node_modules/playwright`; no password typed. Pure functions (`projectCards` `name`, `buildFullTextHtml`) are covered by `vitest` with no external dependency. These are ordinary cap6 test-setup choices, not user decisions.

## Future Or Conditional Decisions

- Localizing `content.cards[].name` and the lesson title into non-source locales (requires translation nodes / overlay entries) — a later translation ticket, not this one.
- Pagination/collapse of a very long 速览 课后题 list — only if length becomes a real usability problem; not needed now (20 items renders fine as a static list).

## Out-of-Scope Guardrails

- No answering, judging, event recording, or progress change from 全文速览 课后题 (backed by seed grill G-3 / D3).
- No change to the practice `QuizDrawer` answering/scoring contract; it is reused only as the read source for the 速览 list.
- No change to the derived `sr_lessons.html` cache; titles/section names render from JSONB (`card.name`) + `getLessonLabel`, never the html cache.
- No schema change, no new query beyond the existing `getLessonQuestions`/`getLessonReading` reads, and no new dependency; only `app/` changes.
- No translation of section names/lesson title this ticket (D4).
