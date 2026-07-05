# Unit Test Results

## Amendment (md-narrative rework, post-gate-5) — re-verified

Per user feedback, chapters were changed from HTML to **story-style Markdown** (see im-handoff). Re-verification after the rework:

- `npx tsc --noEmit` → clean; `npm run build` → pass (with `marked` added, md render server-side).
- Ticket tests → **19/19 pass** (`stories.db.test.ts` updated: reads `md`, asserts **≥2000 汉字**, one `>` excerpt, no bullet/numbered lists, no HTML tags).
- Content regenerated: 3 chapters as narrative Markdown, **4151 / 4096 / 4508 汉字** (all ≥2000 via `scripts/wordcount.mjs`), each **passed an independent gate-3** (story-not-sermon; excerpts verified verbatim at source lines 747–752 / 1163–1166 / 33–36; every date/number traced), persisted via the md saver (14/11/13 questions, each with ≥2 open 口试 items).
- Deterministic pre-persist check on all 3 md files: ≥2000 汉字, 1 H1, one excerpt blockquote, 0 list lines, 0 HTML tags, 0 placeholders, ≥2 work questions.
- **Browser (md render):** `/story/ford-c01` renders inline in `<article class="sr-reading">` (no iframe) — H1 title, **18 continuous paragraphs, 1 excerpt blockquote, 0 lists**, 5307 chars; quiz loads 14 questions; login gate for logged-out. Desktop screenshot captured (styled prose reading view).

The sections below are the original cap6 run; the amendment above supersedes any HTML/iframe-specific evidence.

## Commands Run

- `npm run build` (worktree) — production build (server + client). Result: **pass** (regenerates `routeTree.gen.ts` incl. `/story/$id`; `story._id` + `stories` modules built).
- `npx tsc --noEmit` — typecheck. Result: **pass** (0 errors).
- `npx vitest run --config .intentmill/tickets/SR-2-biography-generation/tests/vitest.config.ts` — ticket-scoped tests. Result: **pass — 19/19** (2 files).
- Browser verification via the harness preview tools (headed Chromium): dev server `npm --prefix <worktree> run dev -- --port 3100 --host 127.0.0.1` (launch config `sr2-worktree-dev`, port **3100** — 3000 was occupied). See Browser Verification below.

## Results

- **stories.contract.test.ts** — 15 passed (source/static contract).
- **stories.db.test.ts** — 4 passed (integration vs Azure easy-app Postgres).
- Total: **19 passed, 0 failed.**
- Content generation (sr-story): 3 chapters authored (independent subagents), each **passed gate-3** (independent reviewer; excerpts verified verbatim against Gutenberg 7213 at exact source lines), persisted via `save-story.mjs` (13 + 11 + 11 questions, status=draft).

## Development Test Log

Slices completed, with the focused check run as each landed:

1. **Schema** — added `sr_story_answer_events` to `ssot-schemas/db-schemas/stemrobin.sql`; applied via `psql`. Verified: `information_schema` shows the table; FKs → `sr_story_questions(id)` and `sr_users(user_id)` (later locked by `stories.contract` + `stories.db` tests).
2. **Content (sr-story cap1–5)** — Ford book → 3 chapters + questions → gate-3 → persisted. Verified: `save-story.mjs` shape validation passed for all 3; DB read-back later asserted by `stories.db.test.ts`.
3. **Server fns (`src/lib/stories.ts`)** — wrote the 4 fns; ran `stories.contract.test.ts` → caught 2 over-strict test assertions (comment-bleed on the block boundary + `curriculum` in a comment), tightened them; re-ran → 15/15. Answer-key-secrecy assertion (getStoryQuestions selects exactly the safe columns) passes.
4. **Sidebar + reading route + QuizDrawer parametrization** — `tsc --noEmit` initially flagged a missed `recordAnswer` reference inside `choose()` (renamed to `record`) and stale route types; fixed the reference and ran `npm run build` to regenerate the route tree → typecheck clean.
5. **DB integration** — wrote `stories.db.test.ts` after persistence; ran → 4/4 (story row, 3 draft chapters with excerpts, question shape, answer correctness + event write + cleanup).
6. **Browser** — verified the new UI in a real browser (below).

## Coverage Map

Every `im-plan.md ## Unit Test Plan` item:

- **Answer-key secrecy** (getStoryQuestions sends no `correct_index`/`answer`) → `stories.contract.test.ts` "getStoryQuestions selects exactly the non-secret columns"; corroborated live by the network capture (the getStoryQuestions RPC payload) and by `stories.db` reading the questions.
- **Server-authoritative correctness** → `stories.contract.test.ts` (recordStoryAnswer reads DB `correct_index`, `data.chosen === correctIndex`) + `stories.db.test.ts` (right vs wrong chosen ⇒ correct is_correct).
- **Auth gate** → `stories.contract.test.ts` (currentUserId gate + '请先登录') + browser (logged-out quiz shows the login gate).
- **Persistence shape read-back** → `stories.db.test.ts` (ford story, 3 draft chapters ord 1..3 with `sr-excerpt`, no `{{`, ≥8 questions each, choice in-range / work null).
- **Event write** → `stories.db.test.ts` (insert one `sr_story_answer_events` row, assert, then clean up).
- **Lesson-quiz regression** → `stories.contract.test.ts` (quiz.ts unchanged: getLessonQuestions hides correct_index, recordAnswer → sr_answer_events) + browser (`/lesson/math-s3-01` renders + 卡片答题 button present).
- **Catalog rendering (links / 草稿 tag)** → browser (sidebar 名人传记 → 亨利·福特 3 → 3 chapters as links, each 草稿) + `stories.contract` (DB-driven, StoryCatalogEntry).
- **Rejected options absent** → `stories.contract.test.ts` (no curriculum import; no PDF in story route; `sr_answer_events` FK unchanged; new table targets `sr_story_questions`).
- **iframe chapter render + drawer interaction** (not unit-testable) → browser (below).

## Browser Verification

Tool: the harness **preview MCP** (headed Chromium real browser) — this environment's sanctioned browser-verification surface (the harness directs against ad-hoc bash/Playwright for servers). Assertions were encoded repeatably via `preview_eval` DOM queries, `preview_inspect` computed styles, and screenshots, matching the intent of `playwright-browser-verification.md`. `playwright` is not a repo dependency; no standalone script was added.

- Dev server: `sr2-worktree-dev` on **http://127.0.0.1:3100** (worktree via `npm --prefix`).
- **Sidebar (R-UI):** 名人传记 section renders under 课程大纲 → 亨利·福特 (count 3) → chapters `1/2/3` as links, each with a 草稿 `.sr-tag`. Existing 数学/物理/机器人 unaffected. `CatalogSidebar` React props show `stories: [array(1)]`.
- **Reading route:** `/story/ford-c01` → sandboxed `<iframe srcDoc>` renders the chapter — 5 `[data-sr-section]` sections, `.sr-excerpt` present with the verbatim "The engine had stopped to let us pass with our horses…" passage, title 农场男孩与那台会自己走的机器, iframe auto-height 3613px, ~3.6k chars.
- **Card-quiz:** 卡片答题 opens the drawer; **logged-out → login gate** ("答题需要先登录…去登录"); questions load (header "1 / 13" ⇒ getStoryQuestions returned 13).
- **Layout (DESIGN.md):** at 1280px, `.sr-catalog` width **236px** (visible), `.sr-d-title` single line (23px tall). Screenshots captured (desktop reading view + sidebar 名人传记 section).
- **Lesson regression:** `/lesson/math-s3-01` renders its iframe (3977 chars, title 未知数是什么) with the 卡片答题 button present — the parametrized QuizDrawer did not regress the lesson path.

## Failures

None outstanding. Two transient issues fixed during development: (a) a missed `recordAnswer`→`record` rename inside `QuizDrawer.choose()` (typecheck caught it); (b) two over-strict contract assertions (block-boundary comment bleed; `curriculum` matched in a comment) — tightened to their real intent, then green.

## Notes

- **Logged-in answer-click feedback (green/red + reveal) was not exercised through the browser.** The preset learner's password in this shared DB is not the documented `123456` (verified: `scrypt` default-param check fails for `123456`), and creating a throwaway login user in the shared production Postgres was blocked by the environment's shared-resource guard (correctly). The behavior is instead proven at the layers below the click: `recordStoryAnswer`'s server-side correctness + `sr_story_answer_events` write (DB integration test) and the fact that the story path uses the **identical** shared `QuizDrawer.choose()` code as the pre-existing, working lesson quiz (contract test asserts both call sites inject their source). No product defect; a credentials/data limitation only.
- markitdown was not installed; per the plan's sanctioned fallback, the clean Gutenberg 7213 plain text was used directly as the book source (public-domain, off the frontend critical path).
- The worktree had no `node_modules` (git worktrees don't share it); ran `npm install` first, as the plan anticipated.
