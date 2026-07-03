# IntentMill Draft

## Source

- ticket key: `SR-1-exercise-cap-cardquiz`
- ticket id: `SR-1`
- `meta.json`: read (`.intentmill/tickets/SR-1-exercise-cap-cardquiz/meta.json`)
- `intent.md`: read as raw original user input (not rewritten). "找先机图标" read as a
  speech-to-text slip for a **camera / 拍照 icon** (context: "未来支持用户拍照上传题").
- `AGENTS.md`: read (ticket worktree). Drives simplicity-first, surgical changes,
  SSOT / one-way-only.
- `.evodocs`: empty cap1 scaffold (no substantive content); used targeted code
  inspection instead.
- Code inspected (repo-root-relative): `.agents/skills/sr-lesson/**`
  (`SKILL.md`, `references/common/lesson-contract.md`,
  `references/capability-1-math-lesson/workflow.md`, `lesson-design-system-v1.md`,
  `assets/lesson-template.html`, `scripts/save-lesson.mjs`);
  `public/lessons/math-s3-01.html`; `src/routes/_app/lesson.$id.tsx`,
  `src/routes/_app/index.tsx`, `src/lib/curriculum.ts`;
  `ssot-schemas/db-schemas/stemrobin.sql`; `DESIGN.md`, `DESIGN.guide.md`.
- External interfaces (R-EXT): this ticket now introduces the **Azure easy-app
  shared Postgres** as the app runtime DB and a minimal email/password login.
  Behavior is established from the `n-easyapp` skill + the live deploy (see
  `## Code And Evodocs Findings`); connection facts already known from the earlier
  `redeploy_current_repo` output. No third-party auth SDK is added (Clerk is future).
  Camera/photo upload remains future (its R-EXT investigation is deferred until that
  ticket).
- `nf-db`: cap3 did static SSOT inspection only. The new tables + migration run
  against the easy-app Postgres at implementation time (cap6), not cap3.
- `DESIGN.md`: read; binding for the new UI. Its "Lesson Rendering" section is stale
  (4 sections + deleted "最容易错在哪里"); code + `lesson-contract.md` authoritative.

## Draft Spec

Confirmed after grill (D1–D5 answered; D6 open). Uncertain items still labelled.

Scope A — split the sr-lesson authoring skill (D3):
- The existing lesson cap produces **課文 only** = `motivation / explain / examples /
  connections / oral`; it no longer authors `practice`.
- A **new, separate cap** consumes an existing 課文 and generates the structured
  exercises + the rendered practice.
- 課文 is **saved into Postgres, not local files** (D3). The current exercise pedagogy
  (typed items 辨认/表示/操作/反推/辨错, hidden worked answer, five-category coverage)
  and the PDF are preserved ("都保存").

Scope B — card-quiz UI (D1, D5):
- A **button** in the lesson toolbar opens a **bottom drawer that slides up** — desktop:
  not full-width, not full-height; mobile: same but full-width — showing one exercise
  per card.
- Choice cards present selectable options; **after the learner answers, show
  correct/incorrect and reveal that card's answer** (D1). Work/step/explanation cards
  show a camera placeholder (future photo upload).
- The drawer follows `DESIGN.md` (three colors, green = correct, lucide icons,
  reduced-motion respected).

Scope C — minimal login + learner answer state (D1, D2):
- Add a **minimal email/password login** (preset `edwinbiz@hotmail.com` / `123456`,
  `user_id = 1`); its only purpose is to identify the learner for saving state. No JWT,
  no auth framework; full auth (Clerk) is future.
- Persist **every choice-card answer** so each learner's wrong answers per lesson and
  per question are **traceable** (D2), enabling later weakness analysis and automatic
  lesson recommendation.

Scope D — database platform (D1, D6):
- The app's runtime DB becomes the **Azure easy-app shared Postgres** already
  provisioned for this project (schema `stemrobin-schema`, role `stemrobin-user`);
  new tables are created there via the SSOT schema file. **Supabase is no longer used.**
- [D6 confirmed] One delivery path only: lesson HTML (+PDF bytes) live in `sr_lessons`,
  served via a server function/route; `public/lessons/*` static files are retired.
- [D6 confirmed] **All old lessons are migrated into the same model** (`sr_lessons` +
  `sr_questions`) via a one-off temporary conversion tool — no legacy static/Supabase
  path remains; everything goes through this one model.

Non-scope (confirmed):
- No re-authoring of existing lessons' teaching content or exercises (D4); old items are
  data-converted into `sr_questions`, not rewritten. Validate the new pipeline with
  `math-s3-03` first, then convert the old data.
- No photo capture/upload/grading (only the nullable `answer_blob_id` column is
  pre-wired); no Clerk; no score/mastery aggregate columns; no Supabase tables; no
  `public`/r_* access.

## Draft Plan

Rough direction (final plan is cap5):

- **DB**: add a schema file targeting the easy-app Postgres `stemrobin-schema` with the
  minimal tables (`sr_users`, `sr_lessons`, `sr_questions`, `sr_answer_events`) from
  the grill Recommended Defaults; apply via migration against the existing easy-app PG
  (do not re-provision — n-easyapp cap1 already created the schema/role at first deploy).
  `sr_answer_events` references only `question_id` (lesson derived via the question) and
  carries a nullable `answer_blob_id` for future work-answer photos (not implemented).
- **Data access**: replace the browser Supabase client with server-side
  `createServerFn` handlers using the server-only Postgres connection string
  (easy-app PG has no anon REST/RLS). All lesson reads and answer writes go through
  server functions.
- **sr-lesson split**: old cap-1 stops emitting `practice`; a new cap reads the 課文,
  authors structured exercises, renders the practice, and persists to Postgres. Extend
  `save-lesson.mjs` to write to the easy-app PG and populate exercises (it currently
  hard-validates the `practice` anchor and upserts only `html` to Supabase).
- **Login**: a login page + server route verifying email/hashed password against
  `sr_users`, setting a signed httpOnly cookie with `user_id`; logout clears it.
- **Quiz UI**: a bottom-drawer card component launched from
  `src/routes/_app/lesson.$id.tsx`, reading exercises via a server fn, recording each
  choice answer via a server fn, styled to `DESIGN.md` tokens in `src/styles/app.css`.
- **Validation**: generate `math-s3-03` end-to-end on the new pipeline; if poor, delete
  and regenerate.
- **Old-data migration**: after validation, run a one-off throwaway conversion tool
  (temp skill/subagent) that parses each existing lesson's static HTML into `sr_lessons`
  + `sr_questions` rows in Postgres, so all data uses the one model; then retire the
  static files. Not a kept capability.
- Leave lesson teaching content, the answers-hidden PDF rule, and unrelated code
  untouched beyond what the split/move require.

## Code And Evodocs Findings

- **Lesson delivery is currently an iframe of static HTML.**
  `src/routes/_app/lesson.$id.tsx` renders `<iframe src="/lessons/<id>.html">` and the
  toolbar links to static `/lessons/<id>.pdf`. => The card-quiz button lives in this
  React toolbar; moving 課文 to Postgres (D3) means the iframe `src` becomes a server
  route/fn and the static `public/lessons/*` files are retired (D6).
- **Practice HTML shape** (`assets/lesson-template.html`,
  `public/lessons/math-s3-01.html`): `<section data-sr-section="practice">` →
  `<ol class="sr-practice">` `<li>` with a `<span class="sr-ptype">` and a hidden
  `<div class="sr-answer">`. **No options / correct-choice / answer-mode exist today** —
  the new cap must author them.
- **`save-lesson.mjs`** validates six section anchors incl. `practice`, generates the
  static PDF (headless Chromium), and upserts `id, subject, stage, lesson_order, title,
  concept, html, status` to Supabase via `SUPABASE_POOLER_URL`. => It must change to
  target the easy-app Postgres, drop the mandatory `practice` anchor for 課文-only
  saves, and populate exercises.
- **Current DB is Supabase** (`ssot-schemas/db-schemas/stemrobin.sql`, schema
  `stemrobin`, `sr_lessons` has unused `knowledge`/`exercises` jsonb, RLS exposes
  `published` rows to anon). => Being replaced by the easy-app Postgres `stemrobin-schema`;
  the SSOT schema file is rewritten for the new platform.
- **Easy-app Postgres facts (R-EXT), from `n-easyapp` + live deploy:** shared
  `pg-easyapp-shared`, database `easyapp`, per-project schema `stemrobin-schema` and role
  `stemrobin-user` created by n-easyapp cap1 at first deploy (idempotent "return" on
  re-run — no re-provision needed). It is plain Postgres: **no PostgREST, no anon client,
  no RLS auto-layer** like Supabase — so all access must be server-side with the secret
  connection string (already injected into the Container App as `DATABASE_URL`). This is
  the key consequence: the browser Supabase client is removed and replaced by server fns.
- **Answers-hidden rule vs feedback (resolved by D1):** the contract's "answers never
  revealable by the learner" is deliberately relaxed **for the interactive quiz** — after
  answering, correctness + that card's answer are shown. The printed PDF answer key stays
  hidden.
- **Type tag ≠ answer-mode:** some 操作 items have a single closed answer (choosable)
  while others need steps; the new cap emits an explicit per-item `answer_mode`.
- R-UI peer patterns (grounding the drawer/quiz recommendation): Quizlet "Learn" (per-card
  MCQ + reveal), Duolingo lesson slides (one card, bottom primary action, immediate
  feedback), Anki (self-graded cards — the model for work/step cards with no auto-check),
  Photomath/Gauth scan-to-solve (precedent for the future camera upload). Bottom-sheet
  drawer pattern (D5) matches mobile-first sheets in these apps. Touched surfaces:
  `lesson.$id.tsx` toolbar (2nd action beside Download), `src/styles/app.css`
  (`--sr-*`, `.sr-icontool`, `.sr-btn`), the lesson iframe (becomes DB-served), the new
  login page, and the stale `DESIGN.md` "Lesson Rendering" section.

## Assumptions

- [low-risk] Card-quiz is a React feature over app-owned data (not script in the printed
  HTML); PDF/print stays.
- [low-risk] "找先机图标" = camera icon; placeholder only this ticket.
- [confirmed D1/D2] Feedback + reveal-after-answer; minimal login; answer-state tracked
  per learner/lesson/question in the Azure easy-app Postgres.
- [confirmed D3] 課文 stored in Postgres, not local files.
- [confirmed D4] No back-fill; `math-s3-03` is the test lesson; design tables first,
  minimal fields.
- [confirmed D5] Bottom drawer, not full on desktop, full-width on mobile.
- [confirmed D6] One DB-backed delivery path; all old lessons migrated into the same
  model via a one-off conversion tool; no legacy static/Supabase path.

## Risks

- **DB platform migration (large):** moving off Supabase to the easy-app Postgres touches
  the DB client, `save-lesson.mjs`, the SSOT schema file, the lesson-load path, and the
  PDF path. Highest blast-radius risk in this ticket.
- **SSOT / dual source:** exercises exist as structured data (quiz) and as rendered
  practice HTML (PDF). Keep one source (structured) and derive the HTML, or they diverge
  (AGENTS.md §5). Same for lessons if any static files linger during transition (D6).
- **Access-model change:** easy-app PG has no anon REST/RLS; forgetting to route a
  read/write through a server fn would either break or leak the DB credential. All access
  must be server-side.
- **Minimal-auth security posture:** email/password with a preset user and no JWT is
  intentionally weak; must still hash the password and use an httpOnly cookie, and must
  not be presented as real auth. Acceptable only because Clerk replaces it later.
- **`save-lesson.mjs` contract change:** relaxing the `practice` anchor and switching DB
  targets is a real change with DB-write blast radius.
- **New authored data quality:** MCQ distractors must be pedagogically sound (tied to the
  taught misconceptions); the new cap's gate must enforce this.
- **Old-data conversion correctness:** parsing existing lesson HTML into `sr_lessons` +
  `sr_questions` must faithfully carry the item text/answer and correctly assign
  `answer_mode`; a bad conversion silently corrupts the quiz for every old lesson. The
  tool is throwaway but its output must be spot-checked.
- **R-TEST (cap6 obstacles):** no test runner configured yet; LLM-generated exercises are
  only shape-testable (valid options, exactly one correct, `answer_mode` present); the
  Postgres answer-write + login need a server-fn/integration test (server-only DB creds,
  a seeded preset user); the drawer quiz needs a Playwright browser test with the dev
  server + seeded lesson/exercise data.

## Grill Required

completed
