# IntentMill Grill

## Blocking Decisions

1.
- id: D1-quiz-feedback-and-login
- question: Does the card-quiz give feedback, and how is the learner identified so answer state can be saved?
- recommendation: Give feedback — after the learner answers a choice card, show correct/incorrect and reveal that item's answer. Persisting per-learner answer state requires identity, so add a minimal email+password login (preset user `edwinbiz@hotmail.com` / `123456`, `user_id = 1`) whose only job is to hold the learner id for saving state; no JWT, no full auth framework. Full auth via Clerk is a future ticket.
- final_decision: Feedback yes: once the learner answers, show whether they were right and reveal that card's answer. Add a simple email/password login page, preset `edwinbiz@hotmail.com` / `123456`, `user_id = 1`. Create the user/answer-state tables in a NEW Azure database via n-easyapp cap1's DB-creation capability (conforming to n-easyapp), NOT Supabase tables. Keep login minimal (likely no JWT) — its sole purpose is to save user state; a complete login will come later with Clerk, so keep it as simple as possible now.

2.
- id: D2-answer-tracking-tables
- question: What is the storage model for exercises and per-learner answer state (SSOT)?
- recommendation: Structured exercises are the SSOT (options + answerMode + correct choice + hidden worked answer). Add answer-state tables so every student's wrong answers per lesson and per question are traceable.
- final_decision: D1 already sets the platform (Azure DB, not Supabase). Design the related tables with the best simple practice, minimal necessary fields, so that each student's wrong answers are fully traceable — this lets me identify a learner's weak areas and is the foundation for future automatic lesson recommendation.

3.
- id: D3-cap-split-and-lesson-storage
- question: After the split, what does the old (課文) cap emit, and where is the 課文 stored?
- recommendation: Old cap emits 課文 = `motivation / explain / examples / connections / oral` (no `practice`); the new cap produces the structured exercises + rendered practice.
- final_decision: The old cap produces the 課文, and this time the 課文 is saved into Postgres — no longer saved to local files.

4.
- id: D4-no-backfill-test-lesson
- question: Do we back-fill existing lessons, and how do we validate the new pipeline?
- recommendation: Do not back-fill existing lessons; validate with one fresh lesson.
- final_decision: Do NOT back-fill the old lessons. First architect the table data model — minimal, only the necessary fields, no redundant/currently-unused columns — then generate the NEXT lesson (`math-s3-03` 等式两边同乘同除) as a test of the new pipeline. If the generated result is poor, delete it and regenerate.

5.
- id: D5-quiz-launch-surface
- question: Where does the card-quiz launch from and what surface does it use?
- recommendation: A toolbar button opening a full-screen card-slide overlay.
- final_decision: Agree with a toolbar button launching the card quiz. The surface is a drawer that slides up from the bottom: on desktop it is NOT full-width and NOT full-height; on mobile it is the same but full-width.

6.
- id: D6-lesson-delivery-and-existing-lessons
- question: Once 課文 (and exercises) live in Azure Postgres, how does the app deliver lesson HTML and the PDF, and what happens to the 8 existing lessons currently served as static `public/lessons/<id>.html` + `.pdf`?
- recommendation: Store lesson HTML (and the authoring-time generated PDF bytes) in the Postgres lessons table; the frontend loads HTML through a TanStack server function and serves the PDF from a server route, retiring the static `public/lessons/*` files so there is ONE delivery path (AGENTS.md §5). Do a one-time copy of the 8 existing lessons' HTML/PDF into Postgres so the single DB-backed path still shows them (this is NOT re-authoring exercises — D4 still stands: no exercise back-fill). If instead you want existing lessons left on static files during a transition, that creates a second lesson-load path and must be an explicit choice.
- final_decision: Adopt the recommendation — one delivery path only, from Postgres:
  lesson HTML (and PDF bytes) live in `sr_lessons`, the frontend loads HTML via a
  server function and the PDF via a route, and `public/lessons/*` static files are
  retired. The old data must ALSO use this model: migrate every existing lesson into
  `sr_lessons` + `sr_questions` so everything goes through the one model with no legacy
  static/Supabase path. A one-off temporary conversion tool (a throwaway skill or
  subagent) may be written to convert the old lessons' HTML/practice into the new model.

## Recommended Defaults

- Database platform: the app's runtime DB becomes the Azure easy-app shared Postgres already provisioned for this project (`pg-easyapp-shared`, database `easyapp`, schema `stemrobin-schema`, role `stemrobin-user`) — the schema/role were created by n-easyapp cap1 at first deploy, so we ADD tables via the SSOT schema file + migration rather than re-provisioning. Supabase is no longer used by this project.
- Access pattern consequence (R-EXT): the easy-app Postgres is plain Postgres with no PostgREST/RLS anon client (unlike Supabase). All reads/writes go through server-side TanStack `createServerFn` using the server-only Postgres connection string; the browser never holds the DB credential. The existing browser Supabase client for `stemrobin` is removed.
- Minimal data model (Azure `stemrobin-schema`, only necessary fields):
  - `sr_users(user_id PK, email UNIQUE, password_hash, created_at)` — preset row `user_id=1`, `edwinbiz@hotmail.com`, hashed `123456`.
  - `sr_lessons(id PK, subject, stage, lesson_order, title, concept, html, status, created_at, updated_at)` — 課文 moves here; `UNIQUE(subject,stage,lesson_order)`.
  - `sr_questions` — structured items per lesson (SSOT for the quiz; renamed from
    "exercises" per user): `id PK, lesson_id FK, ord, type, prompt,
    answer_mode('choice'|'work'), options jsonb (choice only), correct_index (choice
    only), answer` (hidden worked solution). A real per-question table (not a lesson
    jsonb blob) so answer events can FK a specific question id.
  - `sr_answer_events(id PK, user_id FK, question_id FK, is_correct, chosen,
    answer_blob_id, answered_at)` — one row per attempt, referencing only the
    **question id** (lesson derived via the question, no redundant lesson_id). Covers
    BOTH types: for `choice` questions, `chosen` + `is_correct` are set and
    `answer_blob_id` is null; for `work` questions, `answer_blob_id` holds the id of
    the learner's answer-photo blob (and `is_correct` stays null until reviewed).
    `answer_blob_id` is a nullable forward-compat column only — the photo capture/upload
    and blob store are NOT implemented this ticket. No score/mastery aggregate column
    (derive by query).
- Session: a login server route verifies email + hashed password against `sr_users`, then sets a signed httpOnly cookie carrying `user_id`; logout clears it. No JWT. Password stored hashed (node `crypto.scrypt`), never plaintext, even for the preset user.
- Login gating: lessons remain publicly viewable; starting the card-quiz and saving answers require being logged in. A minimal login page/route is added.
- Answer recording: `choice` cards write an `sr_answer_events` row with `chosen` +
  `is_correct` on answer. `work` cards are modeled to write a row too (via
  `answer_blob_id` for the answer photo), but the capture/upload is future — this
  ticket wires only the `choice` path and leaves `answer_blob_id` unused.
- Exercise generation cap: emits `{prompt (KaTeX), type, answer_mode, options[]+correct_index for choice, answer}`; choice cards get 3–4 options with exactly one correct and distractors grounded in the taught misconceptions (辨错 traps).
- Drawer visuals: bottom sheet using DESIGN.md tokens (teal-blue selection, green for correct, pure white), lucide icons, reduced-motion disables the slide-up animation; not full-height/width on desktop, full-width on mobile.
- Test lesson: `math-s3-03` (等式两边同乘同除), the next lesson in stage 3, generated via the split caps end-to-end as the acceptance probe.
- Old-data migration (D6): a one-off temporary conversion tool (throwaway skill or
  subagent, not a kept capability) reads each existing lesson's static HTML, splits
  課文 vs practice, and writes `sr_lessons` + `sr_questions` rows into the easy-app
  Postgres so old lessons use the identical model. Ordering reconciles with D4: build
  the model + validate the new pipeline on `math-s3-03` first, THEN run the conversion
  over the existing lessons. Conversion imports the existing hand-authored practice as
  `sr_questions`; where an item is closed-form it becomes `answer_mode='choice'` with
  generated options, otherwise `answer_mode='work'` — it does not re-author teaching
  content. This is a data conversion, not the "exercise back-fill" D4 declined.
- Reuse `save-lesson.mjs` (extended to write to Postgres and populate exercises) rather than a new persistence script; the SSOT schema file moves to target the easy-app Postgres `stemrobin-schema`.
- Tests (cap6): schema/shape tests for generated exercises and for the answer-event write; a Playwright browser test for the drawer quiz + login flow (repo already depends on `playwright-core`); runner selection left to cap6.

## Future Or Conditional Decisions

- Clerk-based complete authentication (replaces the minimal email/password login).
- Photo capture / upload / a blob store for answer photos / grading of handwritten
  step/explanation work — the future flow the camera icon and the nullable
  `sr_answer_events.answer_blob_id` column are pre-wired for.
- Automatic lesson recommendation driven by the per-learner wrong-answer history (the reason D2 tracks answers).
- Persisting aggregate mastery/score (derive-by-query is enough this ticket).
- Physics subject exercises (sr-lesson is math-only this stage).
- `knowledge` jsonb extraction — unrelated future work.

## Out-of-Scope Guardrails

- No Supabase tables for this project's data; the runtime DB is the Azure easy-app Postgres.
- No JWT and no full auth framework this ticket; the minimal login only holds `user_id` to save state.
- Minimal necessary columns only; do not add score/mastery aggregates or any currently-unused field.
- No photo capture, upload, storage, OCR, or grading (camera icon is an inert placeholder).
- Do not add Clerk in this ticket.
- Do not touch the `public` (r_*) tables or the HouseRobin Supabase database.
- Fixing the pre-existing stale `DESIGN.md` "Lesson Rendering" section (predates this ticket) is out of scope per AGENTS.md surgical-changes; the new quiz still conforms to existing `DESIGN.md` tokens/rules.
