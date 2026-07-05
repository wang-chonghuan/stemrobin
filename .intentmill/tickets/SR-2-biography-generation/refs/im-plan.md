# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract for cap6. `im-draft.md` and `im-grill.md` are background provenance; every material constraint has been promoted into `im-spec.md` and this plan — cap6 does not need to reread them to discover requirements.

> **Amendment (post-gate-5, per user feedback):** chapters are stored as **Markdown** (`sr_story_chapters.md`) and rendered md→html server-side (`marked`) into a styled `.sr-reading` container — NOT stored HTML in an iframe. The narrative must be story-like (continuous prose, no lists, minimal 说教, ≥2000 汉字 via `wordcount.mjs`; ≥2 open 口试 items). Read the "iframe"/"stored HTML"/"getChapterHtml" wording below as amended: the reading render is inline md→html, and the chapter server fn is `getChapterView` (returns rendered html from md).

## Implementation Approach

Mirror the existing lesson delivery seams and add the story equivalents beside them; keep changes surgical (AGENTS.md). Concretely:

- **Schema:** extend the SSOT `ssot-schemas/db-schemas/stemrobin.sql` with `sr_story_answer_events` (mirror of `sr_answer_events`, `question_id → sr_story_questions(id)`), then apply it with `psql "$EASYAPP_DATABASE_URL" -f …`. The three story content tables already exist and are applied.
- **Content:** run `sr-story` for 福特《My Life and Work》(Gutenberg 7213): cap1 book→md (`scripts/book-to-md.mjs`, markitdown), cap2 outline (independent subagent), cap3 author each of chapters 1–3 (independent subagent) with `gate-3` before each persist, cap4 questions, cap5 `scripts/save-story.mjs`. Story id `ford`, chapters `ford-c01..c03`, `status='draft'`.
- **Server functions:** new `src/lib/stories.ts` mirroring `src/lib/lessons.ts` + `src/lib/quiz.ts`, all through `src/lib/db.ts` `sql()`:
  - `listStories()` / `getStoryChapters(storyId)` → the sidebar's story+chapter list (DB-driven), returning ids/titles/ord/status so the catalog can render links vs stubs and the 草稿 tag;
  - `getChapterHtml(chapterId)` → chapter `html` (mirror `getLessonHtml`);
  - `getStoryQuestions(chapterId)` → `id, ord, type, prompt, answer_mode, options` from `sr_story_questions` ordered by `ord`, **excluding `correct_index` and `answer`**;
  - `recordStoryAnswer({questionId, chosen})` → `currentUserId()` gate, read `correct_index/answer/answer_mode` server-side for that story question, compute `is_correct`, `insert into sr_story_answer_events`, return `{isCorrect, correctIndex, answer}`.
- **Sidebar + route:** add the 名人传记 section to `src/components/catalog.tsx` using the `.sr-out-*` pattern fed by `listStories`/`getStoryChapters`; add a chapter reading route mirroring `src/routes/_app/lesson.$id.tsx` (loader → `getChapterHtml` → existing sandboxed `iframe srcDoc`).
- **Quiz reuse:** parametrize `QuizDrawer` so its question fetch and record function are injected (lesson mode = `getLessonQuestions`/`recordAnswer`; story mode = `getStoryQuestions`/`recordStoryAnswer`), preserving all existing UI behavior. Do not fork the component.

## Implementation Drift Controls

- **Answer-key secrecy is mandatory.** `getStoryQuestions` must not select or return `correct_index`/`answer` to the client; `recordStoryAnswer` computes correctness server-side. Any payload carrying `correct_index` to the browser is a spec violation.
- **Auth-gated, server-authoritative recording.** `recordStoryAnswer` must gate on `currentUserId()`, verify `answer_mode='choice'`, and write server-side — matching `recordAnswer`. No client-trusted correctness.
- **Persistence only via `save-story.mjs`, after `gate-3`.** No hand-written story rows; no persisting a chapter that failed `gate-3`.
- **Public-domain only.** Excerpts must be genuine passages from the Gutenberg 7213 text; a fabricated excerpt is a hard `gate-3` failure.
- **Single DB client / schema SSOT.** Reuse `db.ts` `sql()`; add the new table only in `ssot-schemas/db-schemas/stemrobin.sql` and apply — never create tables ad hoc or open a second client.
- **`QuizDrawer` must not regress lessons.** After parametrization, the lesson quiz path must be verified unchanged.
- **Rejected options must not reappear:** do not loosen the `sr_answer_events` FK; do not defer story answer-tracking; do not hardcode the story/chapter list into `curriculum.ts`; do not integrate the home 学习进度 card; do not author books other than Ford.
- **Fail-fast, no silent fallback.** If `sr_story_answer_events` is missing at runtime, `recordStoryAnswer` must surface the error (as `recordAnswer` surfaces its errors), not silently no-op. If markitdown cannot be installed, stop and use a clean Gutenberg `.txt` source (recorded in handoff) — do not fake the conversion.
- **DESIGN.md is binding:** `--sr-*` tokens only, `.sr-out-*` rows, 草稿 `--sr-tag`; no new hues/components/layout.

## Phases

1. **Schema.** Add `sr_story_answer_events` to `ssot-schemas/db-schemas/stemrobin.sql`; apply via `psql`; verify the table + FK exist in `stemrobin-schema`. *Verify:* `information_schema` shows the table; a manual insert/rollback references `sr_story_questions`. No other consumers of this new table.
2. **Content generation.** `npm install` in the worktree; ensure `markitdown`; run `sr-story` cap1→cap5 for Ford ch.1–3 with `gate-3` per chapter. *Verify:* three `ford-c*` chapter rows + questions persisted at `status='draft'`; excerpts traceable to Gutenberg 7213.
3. **Server functions (`src/lib/stories.ts`).** Implement the five functions above via `db.ts` `sql()`. *Verify:* `getStoryQuestions` payload contains no `correct_index`/`answer`; `recordStoryAnswer` inserts into `sr_story_answer_events` and computes correctness server-side. Shared-code note: `db.ts`/session reused read-only, no change to their other consumers.
4. **Sidebar + reading route.** Add the 名人传记 catalog section (DB-driven, `.sr-out-*`, 草稿 tag) and the chapter route (sandboxed iframe). *Verify:* Ford chapters appear as links, stubs stay non-clickable, chapter HTML renders in the iframe; existing math/physics catalog unaffected.
5. **Quiz parametrization.** Inject fetch/record fns into `QuizDrawer`; wire story mode from the chapter route. *Verify (regression):* the lesson quiz (choice shuffle, feedback, reveal, login gate, `sr_answer_events` write) still works unchanged; the story quiz records to `sr_story_answer_events`.
6. **Tests & browser verification.** Add ticket-scoped tests under `.intentmill/tickets/SR-2-biography-generation/tests/` and run a Playwright pass. *Verify:* see Unit Test Plan.

Every phase touching shared code (`QuizDrawer` in phase 5, `db.ts`/session reuse in phase 3) includes the regression check named above.

## Unit Test Plan

Location: `.intentmill/tickets/SR-2-biography-generation/tests/`. Relevant existing behavior to mirror: `src/lib/quiz.ts` (`getLessonQuestions`, `recordAnswer`). Run with the project's test command after `npm install`.

High-risk assertions (not just happy path):
- **Answer-key secrecy:** `getStoryQuestions(chapterId)` result objects contain no `correct_index` and no `answer` key.
- **Server-authoritative correctness:** `recordStoryAnswer` returns `isCorrect` computed from the DB `correct_index`, and a wrong `chosen` yields `isCorrect=false`; the client cannot influence correctness.
- **Auth gate:** `recordStoryAnswer` without a session returns the login error and writes no row.
- **Persistence shape:** after cap5, a DB read-back shows `sr_stories[ford]`, `sr_story_chapters[ford-c01..c03]` with non-empty `html` and `status='draft'`, and each chapter's `sr_story_questions` (choice items have in-range `correct_index`, work items null) — the write path itself is already smoke-tested across the three content tables.
- **Event write:** a recorded story answer inserts exactly one `sr_story_answer_events` row with correct `user_id/question_id/is_correct/chosen`.
- **Lesson regression:** the lesson quiz still fetches via `getLessonQuestions` and records to `sr_answer_events` (assert the lesson path is untouched by parametrization).
- **Catalog rendering:** persisted chapters render as links, id-less stubs are non-clickable, draft chapters carry the 草稿 tag.
- **Rejected options absent:** no client payload carries `correct_index`; `curriculum.ts` is not the source of the story list; `sr_answer_events` FK unchanged.

Behaviors not unit-testable in isolation (iframe chapter rendering, drawer interaction) are covered by the Playwright pass per cap6 `references/capability-6-dev-unit-test/playwright-browser-verification.md`: sidebar link → chapter iframe renders → open quiz → answer a choice card → feedback/reveal shows → verify a `sr_story_answer_events` row was written.

## Handoff Expectations

After development, cap6 writes `.intentmill/tickets/SR-2-biography-generation/refs/im-handoff.md`: actual changes at file/module granularity (new `src/lib/stories.ts`, `QuizDrawer` parametrization, catalog section, chapter route, the schema addition, and the persisted Ford chapters), whether anything diverged from `im-spec.md`/`im-plan.md` and why, any missed review points, and residual issues or future improvements (e.g. the deferred `sr-story` question gate, remaining books, home-card integration). Do not return to cap4 for new decisions.
