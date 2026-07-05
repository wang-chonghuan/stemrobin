# IntentMill Draft

## Source

- ticket key: `SR-2-biography-generation`
- ticket id: `SR-2`
- `.intentmill/tickets/SR-2-biography-generation/meta.json` read (confirms ticket-key/id/prefix/number/slug and worktree).
- **Primary user intent source: `.intentmill/tickets/SR-2-biography-generation/refs/im-predraft.md`** — a user-authored list of six public-domain American inventor-entrepreneur books (Franklin, Barnum, Carnegie, Rockefeller, Edison, Ford) with legal Gutenberg/Internet Archive links and the hard rule "只推荐合法来源 / 公共领域".
- `.intentmill/tickets/SR-2-biography-generation/intent.md` read as **raw original input / background only**: the single line "生成名人传记". The predraft supersedes this vague wording and the user's cap3 instruction adds the delivery bar below.
- User cap3 instruction (working intent, folded in): after development the **frontend must show a book's first few chapters and be deliverable for the user to review the generated content**.
- User naming/placement decision (folded in, now settled): the user-facing feature/section is named **名人传记** and is placed in the **left sidebar (the catalog)** alongside the subject groups. This supersedes the internal working name 创造者档案 for all app-facing copy; the `sr-story` skill still authors the underlying biography content.
- `AGENTS.md` read and obeyed (Think-before-coding, Simplicity-first, Surgical-changes, SSOT/one-way-only).
- `.evodocs/constitution.md` and `.evodocs/index.json` read: **constitution is entirely `TBD` (no substantive content)**; recorded as a limitation. Targeted code inspection was used instead (see Findings).
- Code inspected (repo-root-relative): `src/routes/__root.tsx`, `src/routes/_app.tsx`, `src/routes/_app/index.tsx`, `src/routes/_app/lesson.$id.tsx`, `src/routes/_app/login.tsx`, `src/components/catalog.tsx`, `src/components/quiz-drawer.tsx`, `src/lib/curriculum.ts`, `src/lib/lessons.ts`, `src/lib/quiz.ts`, `src/lib/db.ts`, `src/lib/session.ts`, `src/lib/session.server.ts`, `src/styles/app.css`, `ssot-schemas/db-schemas/stemrobin.sql`.
- The content generator is the project skill `.agents/skills/sr-story` (its `SKILL.md`, `references/common/story-contract.md`, cap1–cap5 references, `scripts/save-story.mjs`, `assets/chapter-template.html`).
- `DESIGN.md` read (and it requires reading `DESIGN.guide.md`); it is the binding UI source of truth for this ticket. Relevant tokens/components cited in Findings.
- **`find-docs` / Context7 not available** in this repo (no such skill) → external-doc limitation recorded in Findings. **`nf-db` not available** in this repo → DB access limitation recorded; only static SSOT inspection + the deterministic saver were used for schema facts (the write smoke-test used `psql` directly, noted as a limitation).

## Draft Spec

*Draft material — confirm/adjust in grill.*

What must be true after delivery:

- **Content (via `sr-story`).** At least one 名人传记 story exists and its **first few chapters** are authored through `sr-story` cap1→cap5 and persisted to `sr_stories` / `sr_story_chapters` / `sr_story_questions` in `stemrobin-schema`. Sources are strictly public domain with `source_url` recorded. Chapters may remain `status='draft'` for review. (Confirmed by grill: first book = 福特《My Life and Work》, Project Gutenberg 7213; first 3 chapters.)
- **Navigation.** The left sidebar (catalog) exposes a **名人传记 section** — a confirmed decision (name + sidebar placement) — listing the story and its chapters; chapters that have persisted HTML are clickable, mirroring how `sr-lesson` lessons appear (only items with an id are links).
- **Reading.** Opening a chapter renders its self-contained HTML the same way lessons render — an `iframe srcDoc` with the existing sandbox — inside the existing detail pane / top bar.
- **Card-quiz.** A chapter's questions (from `sr_story_questions`) are answerable through the existing `QuizDrawer` mechanism (choice cards with post-answer feedback + reveal, shuffled option display), reusing the existing login gate.
- **Per-learner answers.** A learner's chapter-question attempts are recorded per learner and question in a **new `sr_story_answer_events` table** (confirmed by grill) — a mirror of `sr_answer_events` with `question_id → sr_story_questions(id)` — added to `ssot-schemas/db-schemas/stemrobin.sql` and applied, written by `recordStoryAnswer`. The existing lesson `sr_answer_events` FK is left unchanged.
- **Compatibility.** Existing math/physics lessons, their quiz, login, and home page keep working unchanged. No new hues/components/layout patterns beyond `DESIGN.md`.
- **Deliverable for review.** The user can run the app, navigate to the book, read the first chapters, exercise the quiz, and judge the generated content quality.

Confirmed non-scope (settled by grill): the other five books; a publish/promotion workflow (draft is enough to review); chapter **PDF** download (the story tables intentionally have no `pdf` column, unlike `sr_lessons`); work-answer photo upload; and — confirmed — wiring stories into the home 学习进度 card (the card stays lessons-only this phase; 名人传记 is surfaced only via the sidebar).

## Draft Plan

*Draft direction — rough, not final task steps.*

Reuse existing seams; add the story equivalents beside them (SSOT / one-way, surgical).

1. **Generate content (`sr-story`).** Prereq: `npm install` in this worktree (it has no `node_modules`; see Risks) and `markitdown` installed. Then cap1 (福特《My Life and Work》, Gutenberg 7213 → md via `scripts/book-to-md.mjs`) → cap2 outline (independent subagent) → cap3 author each of the first 3 chapters (independent subagent) + `gate-3` → cap4 questions → cap5 `scripts/save-story.mjs`. The three story content tables already exist in `ssot-schemas/db-schemas/stemrobin.sql` and are applied (done this session; verified by a write smoke-test that was then deleted); the new `sr_story_answer_events` table (below) must also be added and applied.
2. **Catalog + outline data.** Extend `src/components/catalog.tsx` with a **名人传记** sidebar section using the same `.sr-out-subject`/`.sr-out-stage`/`.sr-out-lesson.ready` pattern, draft chapters tagged 草稿 (`--sr-tag`). The story/chapter list is served from a server function over `sr_stories`/`sr_story_chapters` (mirror `listLessonIds`), **not** hardcoded into `src/lib/curriculum.ts` — chapters are DB-authored and AGENTS.md mandates one source of truth (settled as a recommended default in grill).
3. **Reading route.** Add a chapter route mirroring `src/routes/_app/lesson.$id.tsx` (loader → server fn returning chapter `html` → `iframe srcDoc`). Route granularity (per-chapter id like `ford-c01`, vs a story page that lists chapters) is implementation latitude for cap6, not a user decision.
4. **Server functions.** Add `src/lib/stories.ts` mirroring `src/lib/lessons.ts` + `src/lib/quiz.ts`: read chapter HTML, list stories/chapters, `getStoryQuestions(chapterId)` (mirror `getLessonQuestions` over `sr_story_questions`), and answer recording. All go through `src/lib/db.ts` `sql()` with the existing `search_path`. Reuse `currentUserId()` / `SESSION_COOKIE` unchanged.
5. **Quiz reuse.** Parametrize `QuizDrawer` to accept its question-source + record-fn (settled as a recommended default) so the working lesson quiz is untouched; keep a lesson-quiz smoke check. `recordStoryAnswer` writes to the new `sr_story_answer_events` table.
6. **Tests (`tests/`).** Ticket-scoped: server-fn/DB read-back for a persisted chapter+questions (DB write already smoke-tested), and browser/component verification of catalog link → chapter iframe render → quiz answer, per `DESIGN.md`.

Left untouched: existing lesson/quiz/login/home code paths except the minimal `QuizDrawer` parametrization; existing `sr_*` lesson tables.

## Code And Evodocs Findings

No substantive `.evodocs` existed (constitution/index are `TBD`), so intent boundaries come from code, which is authoritative here.

Delivery seams to mirror (all repo-root-relative):

- **Routing** is file-based TanStack Router (`src/routes/_app/…`). `lesson.$id.tsx` uses a `loader` calling `getLessonHtml({ data: id })` and renders the stored HTML in an `<iframe srcDoc={html} sandbox="allow-scripts allow-same-origin allow-modals">` (`LessonFrame`), height driven by a ResizeObserver. PDF via `getLessonPdf` → base64 → Blob. This is the exact pattern a chapter route reuses.
- **Catalog** (`src/components/catalog.tsx`) renders from the hardcoded outline in `src/lib/curriculum.ts` (`CURRICULUM: OutlineSubject[]`, subjects math/physics/robot, nested stages→lessons). Only lessons carrying an `id` become `<Link to="/lesson/$id">`; id-less ones are outline stubs. Peer pattern for the new 名人传记 sidebar nav.
- **Card-quiz** (`src/components/quiz-drawer.tsx`) fetches `getLessonQuestions(lessonId)` from `src/lib/quiz.ts` (`select id, ord, type, prompt, answer_mode, options from sr_questions where lesson_id = … order by ord`), renders choice options with client-side Fisher–Yates display shuffle (`ordersRef`), and records via `recordAnswer({questionId, chosen})` which server-side reads `correct_index/answer` and `insert into sr_answer_events (user_id, question_id, is_correct, chosen)`. Work-mode cards are a camera placeholder. `getCurrentUser()` gates the quiz.
- **DB access** (`src/lib/db.ts`): a memoized `postgres()` client, `ssl:'require'`, `connection:{ search_path:'"stemrobin-schema"' }`. All story server fns must use this same `sql()`.
- **Auth** (`src/lib/session.server.ts`/`session.ts`): HMAC-signed `sr_session` cookie, `currentUserId()` server-side, scrypt password verify. Reused unchanged.
- **DESIGN.md (binding).** Cited rules the UI must follow: catalog item = flat compact button row, `.sr-out-*` classes, hover `--sr-card`, selected `--sr-blue-tint`/`--sr-blue-deep`, trailing count pill; `--sr-*` tokens in `src/styles/app.css` are the value SSOT; iframe lesson rendering; the **Empty state** pattern for a section with no content yet; three-color palette (no new hues), no hero/nested/decorative cards, compact density, serious teacher tone, Chinese copy. The `sr-story` chapter template (`assets/chapter-template.html`) already uses the same `--sr-*` palette, so chapter reading is visually consistent.

**Predraft conflict audit.** No material conflict between `im-predraft.md` and code/SSOT/`intent.md` was found on the content side: the three DB tables the `sr-story` saver writes now exist in `ssot-schemas/db-schemas/stemrobin.sql` and match the saver's columns (verified by the smoke-test). The predraft is **underspecified**, not contradictory: it names books but not which book first, how many chapters, or any frontend — those gaps were resolved in grill (first book = Ford 7213, first 3 chapters, sidebar delivery).

**One real code-vs-intent gap (resolved by grill):** the user wants per-learner tracking "like lessons", but `sr_answer_events.question_id REFERENCES sr_questions(id)` (`ssot-schemas/db-schemas/stemrobin.sql`) — `sr_story_questions` is a separate id space, so story answers cannot go into `sr_answer_events` without a schema change. **Decision:** add a new `sr_story_answer_events` table (mirror of `sr_answer_events`, FK→`sr_story_questions`) to the SSOT and apply it; the lesson FK is left unchanged. This keeps one canonical events table per question id-space (AGENTS.md SSOT).

**External-tooling limitations.** `find-docs`/Context7 are unavailable, so `markitdown` (external, used only by `sr-story` cap1, off the frontend-delivery critical path) and TanStack Start APIs were not doc-fetched; TanStack usage is instead grounded in existing working code (authoritative). `nf-db` is unavailable; schema facts came from the SSOT file and the `sr-story` saver, and the one live write was a `psql` smoke-test (recorded).

## Assumptions

- **Confirmed by grill:** first story = 福特《My Life and Work》 (Gutenberg 7213); first delivery = its first **3** chapters.
- "Deliverable for review" = `status='draft'` chapters visible in-app (tagged 草稿), no publish/promotion step just to review. *(Settled as a recommended default.)*
- The story/chapter list is served from the DB (mirroring `listLessonIds`) rather than hardcoded like `curriculum.ts`, because chapters are DB-authored. *(Settled as a recommended default per AGENTS.md SSOT.)*
- `QuizDrawer` is reused by parametrizing its data source rather than forked. *(Settled as a recommended default; low risk, surgical.)*

## Risks

- **UI (R-UI).** A new catalog section + new reading route are user-visible surfaces. Risk of `DESIGN.md` drift if new components/hues are invented; mitigate by reusing `.sr-out-*` catalog rows, the iframe reader, the Empty-state pattern, and `--sr-*` tokens only. Peer pattern in-repo: the math/physics catalog and `lesson.$id.tsx`. Adjacent surface that could go stale: the home 学习进度 card (`src/routes/_app/index.tsx`) counts lessons — **confirmed out of scope this phase** (card stays lessons-only; 名人传记 only in the sidebar).
- **DB/schema.** Resolved: a new `sr_story_answer_events` table (mirror, FK→`sr_story_questions`) will be added to the SSOT and applied; the lesson FK is left unchanged. Residual risk is the ordinary one of adding + applying a table (already exercised this session for the other three).
- **Component coupling.** `QuizDrawer` is currently hardcoded to lesson server fns; parametrizing it risks regressing the working lesson quiz. Mitigate with a minimal source abstraction and a lesson-quiz smoke check.
- **Content quality (learner-facing).** `sr-story` cap3 is gated (`gate-3` catches fabrication / dumbing-down / whitewash / faked public-domain excerpt), but cap4 questions are only shape-validated (no semantic gate) — a known `sr-story` gap; review content may carry weak questions. Public-domain excerpt fabrication is a hard gate-3 fail, mitigating copyright/authenticity risk.
- **Dev-time testing obstacles (R-TEST), named concretely:**
  - this worktree has **no `node_modules`** (git worktrees don't share it and it was never installed) — `save-story.mjs`, the dev server, and any test must first `npm install` (this session used a temporary symlink to the main checkout's `node_modules` only for the smoke-test);
  - `markitdown` is an external CLI needing `pip install markitdown` before cap1;
  - iframe chapter rendering and the drawer quiz are hard to unit-test → need component/Playwright browser verification;
  - DB write is already smoke-tested (all three tables), so that path is low-risk;
  - no `nf-db`/`find-docs` skills, so DB/live checks use `psql` and code is the doc source.
- **Scope/time.** Authoring several gated chapters via independent subagents is multi-step; scoping to the first book keeps the first deliverable reviewable.
- **Predraft/intent mismatch.** Raw `intent.md` ("生成名人传记") is broad; the predraft + cap3 instruction narrow it to one public-domain book's first chapters plus a review-able frontend. This narrowing is deliberate and recorded, not a conflict.

## Grill Required

completed
