# IntentMill Grill

## Blocking Decisions

1. id: answer-events-table
   question: How should per-learner answers for 名人传记 chapter questions be stored, given that `sr_answer_events.question_id` foreign-keys to `sr_questions(id)` (ssot-schemas/db-schemas/stemrobin.sql) and therefore cannot reference `sr_story_questions`?
   recommendation: Add a new `sr_story_answer_events` table to the SSOT (`ssot-schemas/db-schemas/stemrobin.sql`) mirroring `sr_answer_events` — `user_id → sr_users`, `question_id → sr_story_questions(id)`, `is_correct`, `chosen`, `answered_at` — and apply it; `recordStoryAnswer` writes there. This keeps one canonical events table per question id-space (the same way `sr_story_questions` already mirrors `sr_questions`), leaves working lesson analytics untouched, and satisfies the AGENTS.md SSOT/one-way rule. Rejected: loosening the existing lesson FK (introduces an impossible-state fallback), and deferring answer-tracking (breaks the "per-learner tracking like lessons" intent).
   final_decision: Add a new `sr_story_answer_events` table (mirror of `sr_answer_events`, `question_id → sr_story_questions(id)`) to `ssot-schemas/db-schemas/stemrobin.sql` and apply it; `recordStoryAnswer` writes there.

2. id: first-book-and-chapters
   question: Which public-domain book is the first 名人传记, and how many chapters should the first deliverable contain for review?
   recommendation: 富兰克林《The Autobiography of Benjamin Franklin》(Project Gutenberg 20203, per im-predraft.md) for its first 3 chapters. It is a single-author public-domain autobiography — the lowest fabrication/copyright risk and cleanest Gutenberg text of the six — and 3 gated chapters is enough to judge generated quality without a long authoring run.
   final_decision: 福特《My Life and Work》(with Samuel Crowther, Project Gutenberg 7213, per im-predraft.md); author its first 3 chapters for review.

3. id: home-progress-card-scope
   question: The home 学习进度 card (`src/routes/_app/index.tsx`) counts only lessons; 名人传记 chapters will not appear there. Leave the home card lessons-only this phase and surface 名人传记 solely via the new sidebar section?
   recommendation: Yes — keep the home card lessons-only for now and expose 名人传记 only through the sidebar section, revisiting home-card integration once stories are published. This is raised explicitly (not silently dropped) per the R-UI scope-cut rule; the card is a draft/review-stage adjacent surface and expanding it now would widen scope before the feature is validated.
   final_decision: Yes — home 学习进度 card stays lessons-only this phase; 名人传记 is surfaced only via the sidebar section. Home-card integration is deferred until stories are published.

## Recommended Defaults

- Sidebar treatment (name + placement already confirmed by the user): render 名人传记 as a sidebar section in `src/components/catalog.tsx` mirroring the `.sr-out-subject` / `.sr-out-stage` / `.sr-out-lesson.ready` pattern; chapters with persisted HTML become `<Link>`s (id-less ones stay stubs, like lessons), draft chapters carry the existing outline `--sr-tag` 草稿 label (DESIGN.md); `--sr-*` tokens only, no new hues/components.
- Story/chapter list source: serve it from a server function over `sr_stories`/`sr_story_chapters` (mirror `listLessonIds` in `src/lib/lessons.ts`), not a hardcoded array in `src/lib/curriculum.ts` — chapters are DB-authored and AGENTS.md mandates one source of truth (the DB), so duplicating them into a static outline would create a second source of truth.
- Chapter reading route: mirror `src/routes/_app/lesson.$id.tsx` — a per-chapter route whose loader returns the stored chapter `html`, rendered in the existing `<iframe srcDoc … sandbox="allow-scripts allow-same-origin allow-modals">` (`LessonFrame`) inside the current detail pane / top bar.
- Quiz reuse: parametrize the existing `QuizDrawer` (`src/components/quiz-drawer.tsx`) with its question-source + record-fn — add `getStoryQuestions(chapterId)` and `recordStoryAnswer` mirroring `getLessonQuestions`/`recordAnswer` in `src/lib/quiz.ts` — rather than forking the component, and keep a lesson-quiz smoke check so the shared UI does not regress. User-visible behavior is identical either way, so this is implementation latitude, not a product choice.
- Draft visibility for review: the sidebar shows `status='draft'` chapters (the single preset learner is the reviewer), tagged 草稿; no separate publish workflow this phase. This follows directly from the user's explicit "deliver for review" intent.
- DB / auth access: all new story server functions go through `src/lib/db.ts` `sql()` with the existing `search_path: '"stemrobin-schema"'`, and reuse `currentUserId()` / `SESSION_COOKIE` (`src/lib/session.server.ts`) unchanged.
- markitdown (R-EXT): convert the Gutenberg source with `sr-story` cap1 `scripts/book-to-md.mjs` (Microsoft markitdown); install once via `pip install markitdown`; its output is scratch source material (not committed) and the source is public-domain — no cost/retention/privacy/permissions impact, so consent is already settled by the sr-story skill design and repo intent.
- Dev-time setup & tests (R-TEST): cap6 first runs `npm install` in this worktree (it has no `node_modules`; git worktrees don't share it); ticket-scoped tests do a server-fn/DB read-back of a persisted chapter + questions (the DB write path is already smoke-tested across all three tables) plus a Playwright pass over sidebar link → chapter iframe render → quiz answer, per cap6's `playwright-browser-verification.md`. These are ordinary cap6 mock/command choices.

## Future Or Conditional Decisions

- Remaining five books (Franklin 20203, Barnum 50115, Carnegie 17976, Rockefeller 17090, Edison 820 — im-predraft.md): authored in later phases once the first book (Ford 7213) pipeline + UI are validated.
- sr-story question quality gate: cap4 questions are currently only shape-validated (no semantic gate); this phase relies on `sr-story` gate-3 (chapter) plus the user's own content review. Adding an sr-story question gate is a later improvement (flagged by the earlier n-telos review).
- Chapter PDF download: the story tables intentionally have no `pdf` column (unlike `sr_lessons`); add PDF generation only if a download need appears.
- markitdown unavailable/uninstallable: fall back to a clean Gutenberg plain-text (`.txt`) source directly (sr-story cap1 notes a `.txt` may be kept as-is) — only if the tool cannot be installed.

## Out-of-Scope Guardrails

- Only the first book is authored in this ticket; the other five are not.
- No work-answer photo upload for story questions — work-mode cards stay the existing camera placeholder, same as lessons.
- No publish/promotion workflow — chapters remain `draft`.
- No changes to existing math/physics lessons, their quiz, login, or the home card's lesson logic (beyond the scope decision in Blocking Decision 3).
