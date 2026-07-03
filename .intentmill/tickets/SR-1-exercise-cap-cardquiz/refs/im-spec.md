# IntentMill Spec

## Intent

Split the `sr-lesson` authoring skill so the existing capability produces only the
課文 (teaching body) and a new capability generates a lesson's 練習 from that 課文.
Add a learner-facing **card-quiz**: a button on the lesson view opens a bottom
drawer of one-question-per-card; closed-form questions are answered by choosing an
option and, after answering, the learner sees whether they were right and that
card's answer; step/explanation questions show a camera placeholder (future photo
upload). Persist every choice answer per learner so a learner's wrong answers are
traceable for later weakness analysis and lesson recommendation. Introduce a minimal
email/password login only to identify the learner. Move all project data onto the
Azure easy-app Postgres under one unified model, including a one-off migration of the
existing lessons; the previous Supabase tables and static `public/lessons/*` files
are retired.

## Scope

- Split `sr-lesson`: the existing lesson capability emits 課文 only
  (`motivation / explain / examples / connections / oral`), not `practice`.
- A new `sr-lesson` capability reads a lesson's 課文 and authors the structured
  question set + rendered practice for that lesson.
- New Postgres schema (Azure easy-app `stemrobin-schema`): `sr_users`, `sr_lessons`,
  `sr_questions`, `sr_answer_events`, applied via the repo SSOT schema file.
- Server-side data access (TanStack `createServerFn`) for all lesson reads and answer
  writes; remove the browser Supabase client.
- Lesson delivery from Postgres: HTML via a server function, PDF via a server route;
  retire static `public/lessons/*`.
- Minimal email/password login (preset `edwinbiz@hotmail.com` / `123456`,
  `user_id = 1`), session via signed httpOnly cookie holding `user_id`.
- Card-quiz UI: a lesson-toolbar button opening a bottom drawer (desktop: not
  full-width, not full-height; mobile: full-width), one question per card, choice
  cards with options + post-answer feedback and answer reveal, work cards with a
  camera placeholder; writes an `sr_answer_events` row for each choice answer.
- One-off temporary conversion tool (throwaway skill/subagent) that migrates every
  existing lesson's HTML into `sr_lessons` + `sr_questions`.
- Validation: generate `math-s3-03` (等式两边同乘同除) end-to-end via the split caps.

## Non-Scope

- No photo capture, upload, blob store, OCR, or grading of work answers; only the
  nullable `sr_answer_events.answer_blob_id` column is pre-wired.
- No re-authoring of existing lessons' teaching content or exercises; old items are
  data-converted, not rewritten.
- No JWT and no auth framework; full authentication (Clerk) is a future ticket.
- No score/mastery aggregate columns (derive by query).
- No Supabase tables for this project; no access to the `public` / `r_*` tables or the
  HouseRobin Supabase database. The old Supabase `stemrobin` schema (incl. its
  `sr_progress` table) is retired, not carried over; per-learner state starts fresh in
  `sr_answer_events`.
- No physics-subject exercises; `sr-lesson` stays math-only this stage.
- No `sr_lessons.knowledge` extraction.
- No fix to the pre-existing stale `DESIGN.md` "Lesson Rendering" section.

## Requirements

Data model (Azure easy-app Postgres, schema `stemrobin-schema`; minimal necessary
columns only):

- `sr_users(user_id PK, email UNIQUE NOT NULL, password_hash NOT NULL, created_at)`.
  Seed exactly one row: `user_id = 1`, `edwinbiz@hotmail.com`, `password_hash` =
  scrypt hash of `123456`. Password is never stored in plaintext.
- `sr_lessons(id PK, subject, stage, lesson_order, title, concept, html, status,
  created_at, updated_at)`, `UNIQUE(subject, stage, lesson_order)`. `html` holds the
  課文 (the self-contained lesson HTML). `status IN ('draft','published')`.
- `sr_questions(id PK, lesson_id FK -> sr_lessons(id), ord, type, prompt,
  answer_mode CHECK IN ('choice','work'), options jsonb NULL, correct_index NULL,
  answer)`. `options`/`correct_index` are set only for `answer_mode='choice'`;
  `answer` holds the hidden worked solution. `type` is the pedagogy tag
  (辨认/表示/操作/反推/辨错).
- `sr_answer_events(id PK, user_id FK -> sr_users, question_id FK -> sr_questions,
  is_correct NULL, chosen NULL, answer_blob_id NULL, answered_at)`. One row per
  attempt. References only `question_id` (lesson is derived via the question).
  For `choice` answers `chosen` + `is_correct` are set and `answer_blob_id` is null;
  the `answer_blob_id` column is a nullable forward-compat slot for a future
  work-answer photo and is unused this ticket. No aggregate/score column.

Authoring skill split:

- The existing `sr-lesson` capability MUST emit 課文 with the five sections
  `motivation / explain / examples / connections / oral` and MUST NOT emit `practice`.
- A new `sr-lesson` capability MUST take an existing lesson's 課文 as input and produce
  the structured `sr_questions` for it (each item: `prompt` KaTeX, `type`,
  `answer_mode`, and for choice items 3–4 `options` with exactly one correct
  `correct_index` whose distractors are grounded in the taught misconceptions, plus a
  hidden `answer`) and the rendered practice used for the PDF.
- Both capabilities MUST keep the existing authoring discipline: an independent
  subagent authors, a gate reviews before persistence, and persistence goes only
  through the deterministic saver — never hand-written DB rows.
- 課文 MUST be persisted into `sr_lessons` in Postgres, not to a local file.

Persistence and delivery:

- All lesson reads (list + single lesson HTML) and all answer writes MUST go through
  server-side `createServerFn` handlers using the server-only Postgres connection
  string; the browser MUST NOT hold the DB credential. The prior browser Supabase
  client MUST be removed.
- The lesson view MUST load the 課文 HTML from Postgres (server fn) instead of a static
  `public/lessons/<id>.html` file, and MUST serve the lesson PDF from a server route
  backed by Postgres (or regenerated), retiring the static `public/lessons/*` files so
  exactly one delivery path exists.
- The authoring-time PDF generation (headless Chromium, print media, embedded CJK
  font, answers hidden) MUST be preserved; only its storage/serving location moves.

Login and session:

- A login page MUST let the learner sign in with email + password, verified against
  `sr_users` (scrypt hash compare) in a server handler; on success a signed httpOnly
  cookie carrying `user_id` is set; logout clears it. No JWT.
- Viewing lessons MUST remain public. Starting the card-quiz and writing
  `sr_answer_events` MUST require a logged-in session.

Card-quiz UI (must follow `DESIGN.md`):

- A button in the lesson toolbar (`src/routes/_app/lesson.$id.tsx` `.sr-d-top`, beside
  the existing PDF download) MUST open a **bottom drawer that slides up**: desktop not
  full-width and not full-height; mobile the same but full-width.
- The drawer MUST show one `sr_questions` item per card, in `ord` order.
- For `answer_mode='choice'`: render the options; on the learner's selection, record an
  `sr_answer_events` row, then show correct/incorrect (green = correct per DESIGN token)
  and reveal that card's `answer`.
- For `answer_mode='work'`: render a camera placeholder icon (lucide `Camera`); no
  capture/upload; no answer event.
- Styling MUST use only `--sr-*` tokens/`DESIGN.md` rules (three colors, lucide icons),
  and reduced-motion MUST disable the slide-up animation.

Old-data migration and validation:

- A one-off temporary conversion tool MUST migrate every existing lesson into
  `sr_lessons` + `sr_questions` so all lessons use the identical model; after it runs,
  no lesson is served from a static file or Supabase. Conversion imports existing
  hand-authored practice as `sr_questions` (closed-form → `choice` with generated
  options; otherwise → `work`) and MUST NOT re-author teaching content. The tool is
  throwaway (not a kept capability).
- `math-s3-03` (等式两边同乘同除) MUST be generated end-to-end via the split caps as the
  acceptance probe; a poor result is deleted and regenerated.

## Critical Existing Contracts

- **Lesson pedagogy contract** (`.agents/skills/sr-lesson/references/common/lesson-contract.md`):
  深入浅出, one concept, formal terms landed, KaTeX for math, hand-authored inline SVG
  for figures, five exercise categories 辨认/表示/操作/反推/辨错. The split changes WHERE
  practice is authored, not this pedagogy. 課文 keeps `motivation/explain/examples/
  connections/oral` (概念口试 stays with 課文).
- **Answers-hidden-in-print rule** (`lesson-design-system-v1.md`): the printed PDF MUST
  never show worked answers (`.sr-answer` hidden). The quiz's post-answer reveal is an
  in-app interaction only and MUST NOT change the PDF. This is a deliberate, scoped
  relaxation limited to the interactive quiz.
- **Authoring pipeline** (`.agents/skills/sr-lesson/scripts/save-lesson.mjs`): mechanical
  validation + PDF pre-generation + deterministic persistence. Currently validates all
  six section anchors and upserts only `html` to Supabase; it MUST change to (a) not
  require `practice` for 課文-only saves, (b) target the easy-app Postgres, (c) populate
  `sr_questions` on the exercise path. The independent-subagent + gate discipline stays.
- **DESIGN.md token discipline**: only teal-blue/green/pure-white + `--sr-*`; green is the
  success/correct token; lucide icons; compact; reduced-motion respected. No new hues,
  no mascots, no celebratory callouts.
- **Lesson render host** (`src/routes/_app/lesson.$id.tsx`): the iframe height is measured
  from `body.scrollHeight`; the `src` moves from a static file to a server fn/route but
  the measurement + toolbar (back / title / PDF) behavior must be preserved.
- **easy-app Postgres access model**: plain Postgres, no PostgREST/RLS anon layer — all
  access is server-side; the connection string is a server-only secret (already injected
  into the Container App as `DATABASE_URL`). Do not expose it to the browser.
- **easy-app provisioning**: the `stemrobin-schema` schema and `stemrobin-user` role were
  created by n-easyapp cap1 at first deploy; this ticket ADDS tables via the SSOT schema
  file and MUST NOT re-provision the schema/role.

## Confirmed Decisions

- D1: quiz gives feedback and reveals the card's answer after answering; add a minimal
  email/password login (preset user above); no JWT; Clerk is future.
- D2: `sr_questions` is the exercise SSOT; `sr_answer_events` makes every wrong answer
  traceable per learner and question, for future weakness analysis/recommendation.
- D3: old cap emits 課文; 課文 stored in Postgres, not local files.
- D4: no re-authoring of old lessons; build the model, validate with `math-s3-03`
  (delete + regenerate if poor).
- D5: toolbar button → bottom drawer (desktop not full-w/full-h; mobile full-width).
- D6 + new requirement: one Postgres-backed model and delivery path; all old lessons
  migrated in via a one-off throwaway conversion tool; no legacy static/Supabase path.
- Recommended defaults adopted: server-fn data access; scrypt password hash + httpOnly
  cookie; only choice cards record events; 3–4 options with misconception-grounded
  distractors; reuse the extended `save-lesson.mjs`; Playwright for the quiz/login
  browser test; `math-s3-03` as the probe.

## Compatibility And Regression Constraints

- After migration, all existing lessons MUST remain viewable through the new
  DB-backed path with unchanged reading appearance; the migration MUST NOT lose or
  alter their 課文 content.
- The PDF output (layout, embedded CJK font, hidden answers, practice on its own page)
  MUST remain equivalent to today for lessons that have practice.
- No change to the `public` / `r_*` tables or the HouseRobin Supabase database.
- The DB connection string MUST NOT reach the browser bundle.
- Existing lesson-view behavior (back button, title, PDF download, iframe auto-height)
  MUST keep working after the `src` moves to a server fn/route.

## Open Questions

None.
