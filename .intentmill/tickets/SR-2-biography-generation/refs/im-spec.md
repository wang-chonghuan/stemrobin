# IntentMill Spec

## Intent

Deliver a 名人传记 (biography reading) feature for StemRobin: from a public-domain book, generate its first chapters with the `sr-story` skill, persist them to the database, and surface them in the app's left sidebar with a chapter reading page and the existing card-quiz — so the learner can read and answer, and the user can review the generated content in-app. First book: 福特《My Life and Work》(Project Gutenberg 7213); first 3 chapters.

> **Amendment (post-gate-5, per user feedback during cap6).** A biography chapter is prose, not a math lesson, so:
> - The chapter body is authored and **stored as Markdown** in `sr_story_chapters.md` (NOT self-contained HTML). The app renders md → html at display time (server-side via `marked`) and shows it as prose in a styled `.sr-reading` container — NOT in a sandboxed iframe (that mechanism stays for `sr-lesson`).
> - The narrative must read **like a story for a 12–16-year-old**: continuous prose paragraphs, no bullet lists, minimal 说教, a hook opening, 正文 **≥ 2000 汉字** (enforced by `scripts/wordcount.mjs`). The moral/思辨 material moves into the questions (**≥2 open 口试 items** per chapter).
> Where the requirements below say "stored HTML" / "iframe", read them as amended by this block.

## Scope

- Author Ford's first **3** chapters through `sr-story` cap1→cap5 (each chapter passing `gate-3` before persistence), stored in `sr_stories` / `sr_story_chapters` / `sr_story_questions` (`stemrobin-schema`) at `status='draft'`.
- Add one new table `sr_story_answer_events` to the SSOT (`ssot-schemas/db-schemas/stemrobin.sql`) and apply it.
- Add a **名人传记** section to the left sidebar (`src/components/catalog.tsx`) listing the story and its chapters; chapters with persisted HTML are clickable, draft chapters tagged 草稿.
- Add a chapter reading route (mirroring `src/routes/_app/lesson.$id.tsx`) that renders a chapter's stored HTML in the existing sandboxed iframe.
- Enable the existing card-quiz for chapter questions by parametrizing `QuizDrawer` (`src/components/quiz-drawer.tsx`); record each attempt per learner into `sr_story_answer_events`.
- Add story server functions in a new `src/lib/stories.ts` (chapter HTML, story/chapter list, chapter questions, answer recording).

## Non-Scope

- The other five predraft books (Franklin 20203, Barnum 50115, Carnegie 17976, Rockefeller 17090, Edison 820) — later phases.
- Any publish/promotion workflow; chapters remain `draft`.
- Chapter **PDF** download (the story tables intentionally have no `pdf` column).
- Work-answer photo upload for story questions (work-mode cards stay the existing camera placeholder).
- Home 学习进度 card integration (`src/routes/_app/index.tsx`) — the card stays lessons-only; 名人传记 appears only in the sidebar.
- Any change to existing lesson tables, the lesson quiz behavior, login/session, or the home card's lesson logic — except the minimal `QuizDrawer` parametrization.
- Loosening or altering the existing `sr_answer_events` → `sr_questions` foreign key.

## Requirements

**Content & generation**
- Ford's first 3 chapters are authored via `sr-story` and persisted, one story row (`sr_stories.id='ford'`, source_url = the Gutenberg 7213 URL) + 3 chapter rows (`ford-c01..c03`) + each chapter's questions, all at `status='draft'`.
- Every chapter passes `sr-story` `gate-3` before it is persisted; persistence happens only through `scripts/save-story.mjs`.
- All source text is public domain; excerpts are genuine passages from the cited public-domain source.

**Database**
- A new table `sr_story_answer_events` exists in `stemrobin-schema`, mirroring `sr_answer_events`: `id` identity PK, `user_id BIGINT REFERENCES sr_users(user_id) ON DELETE CASCADE`, `question_id BIGINT REFERENCES sr_story_questions(id) ON DELETE CASCADE`, `is_correct BOOLEAN`, `chosen INT`, `answer_blob_id TEXT` (nullable, forward-compat), `answered_at TIMESTAMPTZ DEFAULT now()`, plus a `(user_id, question_id)` index. It is defined in `ssot-schemas/db-schemas/stemrobin.sql` and applied.

**Reading UI**
- The sidebar shows a 名人传记 section; the Ford story lists chapters `ford-c01..c03` as clickable links (chapters without persisted HTML are non-clickable stubs, as lessons behave); draft chapters carry the outline 草稿 tag.
- Selecting a chapter opens a reading view that renders the chapter's stored HTML inside the existing `<iframe srcDoc … sandbox="allow-scripts allow-same-origin allow-modals">` (the same mechanism as lessons), within the existing detail pane / top bar.

**Card-quiz**
- The card-quiz opens for a chapter and presents its `sr_story_questions`: choice cards with shuffled option display, immediate post-answer feedback and answer reveal; work-mode cards show the existing camera placeholder.
- Answering requires login (same gate as lessons); each choice attempt is recorded to `sr_story_answer_events` with `is_correct` and `chosen`.

**Server access**
- All story data access is server-side through `src/lib/db.ts` `sql()` (existing `search_path`); the browser never receives the DB connection.
- Story server functions reuse `currentUserId()` / `SESSION_COOKIE` unchanged for identity.

**Design**
- All new UI strictly follows `DESIGN.md`: `--sr-*` tokens (SSOT `src/styles/app.css`), the `.sr-out-*` catalog row pattern, the `--sr-tag` 草稿 label, three-color palette (no new hues), compact serious tone, Chinese copy. No new components, hero sections, or layout patterns.

## Critical Existing Contracts

These existing behaviors are load-bearing and must be preserved by the story implementation:

- **Answer-key secrecy.** `getLessonQuestions` selects `id, ord, type, prompt, answer_mode, options` and deliberately **does not send `correct_index` or `answer` to the client**; `recordAnswer` computes correctness server-side from `sr_questions.correct_index` and only then returns the result + reveal answer. `getStoryQuestions` MUST likewise exclude `correct_index`/`answer` from the client payload, and `recordStoryAnswer` MUST compute correctness server-side.
- **Answer recording is authenticated & server-authoritative.** `recordAnswer` calls `currentUserId()`, rejects when absent (`'请先登录'`), verifies the question is `answer_mode='choice'`, then inserts the event. The story equivalent must apply the same auth gate, mode check, and server-side write.
- **Rendering.** Lessons keep their `iframe srcDoc` sandbox (self-contained HTML). **Chapters differ (amended):** the body is stored Markdown, rendered server-side (`marked`) to trusted HTML and shown inline in a styled `.sr-reading` container. The saver rejects embedded HTML in the md, so the rendered output is content we control.
- **Shared DB client.** `src/lib/db.ts` exposes a single memoized `postgres()` client with `search_path: '"stemrobin-schema"'`. Story server functions must reuse it, not create a second client.
- **`sr-story` authoring discipline.** Chapters are authored by an independent subagent, pass `gate-3` (fabrication / dumbed-down / whitewash / faked public-domain excerpt), and are persisted only by `scripts/save-story.mjs` (mechanical shape validation). No hand-written DB rows.
- **DB schema SSOT.** `ssot-schemas/db-schemas/stemrobin.sql` is the single schema source, applied via `psql "$EASYAPP_DATABASE_URL" -f …`. The new table is added there and applied — not created ad hoc.
- **Catalog link convention.** In the catalog, only outline entries carrying an id become `<Link>`s; id-less entries are non-clickable stubs. The story section follows this so unpersisted chapters are not linkable.

## Confirmed Decisions

From `im-grill.md` (all blocking decisions declared):

1. **Answer-events storage** — add a new `sr_story_answer_events` table (mirror of `sr_answer_events`, `question_id → sr_story_questions(id)`); `recordStoryAnswer` writes there. The existing lesson FK is left unchanged. (Rejected: loosening the lesson FK; deferring answer-tracking.)
2. **First book & chapters** — 福特《My Life and Work》(Gutenberg 7213), first 3 chapters.
3. **Home progress card** — stays lessons-only this phase; 名人传记 is surfaced only via the sidebar.

Recommended defaults that constrain implementation: DB-driven story/chapter list via a server function (not hardcoded into `curriculum.ts`), per AGENTS.md SSOT; `QuizDrawer` parametrized (not forked) with a lesson-quiz regression check; draft chapters visible (tagged 草稿) with no publish workflow; story server functions reuse `db.ts` `sql()` and `currentUserId()`; content generation uses `sr-story` (markitdown for cap1). Future/conditional (out of this ticket): remaining five books; an `sr-story` question quality gate; chapter PDF; a plain-`.txt` source fallback if markitdown cannot be installed.

## Compatibility And Regression Constraints

- The lesson card-quiz (`QuizDrawer` used from `lesson.$id.tsx`) must behave identically after parametrization — same fetch, shuffle, feedback, reveal, login gate, and event recording to `sr_answer_events`.
- `sr_answer_events`, `sr_questions`, `sr_lessons`, and lesson analytics are unchanged.
- Existing math/physics catalog rendering and routes are unaffected.
- The single shared `db.ts` client is reused; no second DB client or connection path is introduced.
- The home 学习进度 card's lesson counting is unchanged.

## Open Questions

None.
