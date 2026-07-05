# IntentMill Handoff

Feature: 名人传记 (biography reading) — a public-domain book's first chapters generated via the `sr-story` skill, persisted, and delivered in the left sidebar with a chapter reading page + the reused card-quiz. First book: 亨利·福特《My Life and Work》(Gutenberg 7213), chapters 1–3 (draft).

## Post-gate-5 amendment (user feedback during cap6)

After the first cap6 pass delivered HTML chapters, the user judged the content quality poor and amended the format/style requirement. This handoff reflects the **amended, re-verified** delivery:

- **Storage is Markdown, not HTML.** Chapters are authored and stored as Markdown in `sr_story_chapters.md`; the app renders md → html server-side (`marked`) and shows it as prose in a styled `.sr-reading` container (no iframe for stories; the iframe stays for `sr-lesson`). Biographies are prose, so there's no reason to author self-contained HTML like math lessons.
- **Story, not lesson.** Chapters are continuous narrative paragraphs (no bullet lists, no internal section headings beyond the H1), told like a story for a **12–16-year-old**, with a hook opening and minimal 说教. The moral/思辨 material moved into the questions.
- **Length enforced.** 正文 **≥ 2000 汉字** (~10 min read), checked deterministically by `scripts/wordcount.mjs` and by the saver; if short, the author mines more real detail from the book md. Delivered chapters: **4151 / 4096 / 4508 汉字**.
- **口试 in questions.** Each chapter has **≥2 open `work` items** (品格/思辨) carrying the reflection the prose no longer preaches.
- **Quotes are Chinese, not English** (further user note). The one embedded quote per chapter is a faithful Chinese translation of a real public-domain passage (the gate verifies faithfulness against the English source; the saver rejects an English-language blockquote). English breaks the reading for a Chinese teen.

The `sr-story` skill itself was reworked to this standard (it is the SSOT for future books), so the amendment is durable, not a one-off.

## Actual Changes

`sr-story` skill (rewritten to md-narrative):
- `references/common/story-contract.md`, `references/capability-3-chapter/chapter.md`, `references/capability-4-questions/questions.md`, `references/gate-3-chapter/gate.md`, `references/capability-5-persist/persist.md`, `SKILL.md` — narrative-Markdown story format, 12–16 audience, no-lists/minimal-说教 style, ≥2000 汉字, ≥2 口试 items.
- `scripts/wordcount.mjs` (new) — deterministic 汉字 count with `MIN_HANZI=2000`.
- `scripts/save-story.mjs` — stores `md` (was `html`); validates Markdown shape (H1, one `>` excerpt, no lists, no HTML tags, no `{{}}`), 正文 ≥2000 汉字, and ≥2 `work` questions.
- Deleted `assets/chapter-template.html` (no HTML template needed).

Schema / SSOT:
- `ssot-schemas/db-schemas/stemrobin.sql` — `sr_story_chapters.html` renamed to `md`; applied to the DB (`ALTER TABLE … RENAME COLUMN`). `sr_story_answer_events` table added earlier this ticket (mirror of `sr_answer_events`, `question_id → sr_story_questions(id)`).

Backend:
- `src/lib/stories.ts` — `getStoryCatalog`, `getChapterView` (reads `md`, renders md→html via `marked` server-side), `getStoryQuestions` (excludes `correct_index`/`answer`), `recordStoryAnswer` (server-side correctness → `sr_story_answer_events`). All via `db.ts` `sql()`; reuse `currentUserId()`.
- Added dependency **`marked`** (md→html; used server-side only).

Frontend:
- `src/routes/_app/story.$id.tsx` — renders the server-rendered chapter HTML inline in `<article class="sr-reading">` (replaced the earlier iframe); injects the story quiz source into the shared `QuizDrawer`. No PDF (out of scope).
- `src/styles/app.css` — added `.sr-reading` reading typography (h1/h2/p/strong/em/blockquote) using `--sr-*` tokens.
- `src/components/quiz-drawer.tsx` — parametrized (injected `contentId`/`fetchQuestions`/`record`; single shared drawer).
- `src/routes/_app/lesson.$id.tsx` — passes the lesson quiz source (the only lesson-path change; still iframe for lessons).
- `src/routes/_app.tsx` — loader (`getStoryCatalog`) → sidebar; `src/components/catalog.tsx` — DB-driven 名人传记 sidebar section (`.sr-out-*`, 草稿 `.sr-tag`).

Content (DB rows): `sr_stories[ford]` + `sr_story_chapters[ford-c01..c03]` (Markdown bodies) + `sr_story_questions` (14/11/13; each with ≥2 work items), status=draft. Each chapter passed an independent gate-3 (story quality; excerpts verified verbatim against Gutenberg 7213 at exact source lines).

Tests: `.intentmill/tickets/SR-2-biography-generation/tests/` — `stories.contract.test.ts` (15), `stories.db.test.ts` (4, updated for `md` + ≥2000 汉字 + no-lists/HTML), `test-results.md`.

## Spec And Plan Alignment

Implementation satisfies `im-spec.md` **as amended** (the amendment block in im-spec/im-plan supersedes the earlier "stored HTML"/"iframe" wording). Internal contract coverage:

- **Spec obligations** — met, with the amended format: content generated as narrative Markdown + persisted (draft); new answer-events table; sidebar section; chapter reading via md→html inline render; card-quiz over `sr_story_questions`; per-learner recording; DB/auth reuse; DESIGN.md tokens only (`.sr-reading` uses `--sr-*`).
- **Plan obligations** — followed; build + typecheck + 19 ticket tests pass; browser-verified the md render + sidebar + quiz + lesson regression.
- **Critical existing contracts** — preserved: answer-key secrecy (getStoryQuestions selects only safe columns; correctness server-side), auth-gated recording, single shared `db.ts` client, `save-story.mjs`+gate-3 authoring, schema SSOT. The lesson iframe contract is unchanged; the story rendering intentionally differs (md→html inline, trusted content — the saver forbids HTML in md).
- **Non-scope / rejected options** — absent: other five books, publish workflow, chapter PDF, work-answer upload, home-card integration; `sr_answer_events` FK unchanged; story list DB-driven; QuizDrawer parametrized not forked.
- **Test obligations** — every `## Unit Test Plan` item mapped in `test-results.md ## Coverage Map`; the persistence/shape item now asserts the Markdown format + 汉字 floor.

Deviation rationale: the storage format (md vs html) and reading render (inline vs iframe) differ from the pre-amendment spec because the **user amended the requirement after gate-5**. The change was implemented in the skill (durable SSOT) + feature + regenerated content, and re-verified. New dependency `marked` is justified by the spec amendment (render stored Markdown); it is the standard, zero-dep md parser and is used server-side only.

## User Review Points

- **Content review (the point of this ticket):** the 3 Ford chapters are now story-style Markdown (4151/4096/4508 汉字). Open `/story/ford-c01..c03` to read them and run the card-quiz. Each passed an independent gate-3 (verbatim excerpt, story-not-sermon, ≥2000 汉字), but the prose/quiz quality is yours to judge.
- **Logged-in quiz answering still not shown in-browser** — the preset learner's password here is not the documented `123456`, and creating a test user in the shared DB was (correctly) blocked. The answer path is proven by the DB + contract tests + the shared-drawer code. Not blocking.

Nothing here changes requirements/acceptance/architecture/data/security in a way that needs a return to cap5; the format change was a direct user instruction, implemented and verified.

## Residual Issues And Future Improvements

- **Home 学习进度 card** stays lessons-only (confirmed out of scope); integrate 名人传记 once chapters are published.
- **Remaining five books** — later phases (the skill now produces this narrative-md standard for them too).
- **Old ticket tests dir** may still contain earlier scratch; the persisted content is the source of truth.
- **user_id IDENTITY sequence** in `sr_users` is behind (preset user seeded with explicit id) — app self-signup would collide on `user_id=1`; pre-existing, worth a `setval` fix before public signup.
- **Publish workflow** — chapters are `draft`; promotion + status filtering is future work.
- **sr-story question quality gate** — cap4 questions are shape-validated only (no semantic gate); this phase relies on gate-3 (chapter) + your review.
